import { normalizeTemporaryPassword } from '@mes-courses/sync-core';

import { accountState, temporaryExpiresAt } from '../../domain/account';
import { MailFailedError } from '../ports/mailer';
import type { InviteAccountDeps } from './invite-account';

export type ResendOutcome =
  | { kind: 'sent' }
  | { kind: 'notFound' }
  | { kind: 'notInvited' }
  | { kind: 'mailFailed' };

/**
 * Replaces the temporary password of an account that never signed in and emails the invitation
 * again (US5-6). Transaction 1 stores the new one, the mail goes outside any transaction, and a
 * failed send is undone by transaction 2 so the previous password keeps working.
 */
export const resendCredentials = async (
  deps: InviteAccountDeps,
  id: string,
): Promise<ResendOutcome> => {
  const { store, clock, crypto, hasher, mailer, errorReporter } = deps;
  const temporaryPassword = crypto.generateTemporaryPassword();
  const temporaryPasswordHash = await hasher.hash(
    normalizeTemporaryPassword(temporaryPassword),
  );
  const expiresAt = temporaryExpiresAt(clock.nowMs());

  const replaced = await store.run(async ({ accounts }) => {
    const account = await accounts.get(id);
    if (account === null) return 'notFound' as const;
    if (accountState(account) !== 'invited' || account.email === null) {
      return 'notInvited' as const;
    }
    await accounts.update({
      ...account,
      temporaryPasswordHash,
      temporaryExpiresAt: expiresAt,
    });
    return account;
  });
  if (replaced === 'notFound') return { kind: 'notFound' };
  if (replaced === 'notInvited') return { kind: 'notInvited' };

  try {
    await mailer.send({
      kind: 'invitation',
      to: replaced.email ?? '',
      temporaryPassword,
      expiresAt,
      serverUrl: deps.publicUrl,
    });
  } catch (error) {
    await store.run(async ({ accounts }) => {
      const current = await accounts.get(id);
      if (current === null) return;
      await accounts.update({
        ...current,
        temporaryPasswordHash: replaced.temporaryPasswordHash,
        temporaryExpiresAt: replaced.temporaryExpiresAt,
      });
    });
    errorReporter.report(
      error instanceof MailFailedError ? error : new MailFailedError(),
      {
        operation: 'resendCredentials',
        route: 'POST /v1/admin/accounts/:id/resend-credentials',
        accountId: id,
      },
    );
    return { kind: 'mailFailed' };
  }
  return { kind: 'sent' };
};
