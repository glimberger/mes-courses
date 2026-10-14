import {
  normalizeEmail,
  normalizeTemporaryPassword,
  type AccountSummary,
} from '@mes-courses/sync-core';

import {
  accountState,
  invitationExpired,
  temporaryExpiresAt,
  type AccountRecord,
} from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { ErrorReporter } from '../ports/error-reporter';
import type { IdGenerator } from '../ports/id-generator';
import { MailFailedError, type Mailer } from '../ports/mailer';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { PasswordHasher } from '../ports/password-hasher';
import type { ServerStore } from '../ports/store';

export type InviteAccountDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: Pick<PairingCrypto, 'generateTemporaryPassword'>;
  hasher: PasswordHasher;
  ids: IdGenerator;
  mailer: Mailer;
  errorReporter: ErrorReporter;
  /** Written in the invitation. */
  publicUrl: string;
};

export type InviteOutcome =
  | { kind: 'invited'; account: AccountSummary }
  | { kind: 'invalidEmail' }
  | { kind: 'exists' }
  | { kind: 'mailFailed' };

/** The row the administrator's list shows, from the stored record. */
export const summaryOf = (
  record: AccountRecord,
  lastSyncAt: string | null,
  nowMs: number,
): AccountSummary => ({
  id: record.id,
  // Only the setup account has no address, and it is never listed before `create-admin`.
  email: record.email ?? '',
  role: record.role,
  state: accountState(record),
  lastSyncAt,
  invitationExpired: invitationExpired(record, nowMs),
});

/**
 * Creates an invited account and emails its temporary password, in the order of research R8:
 * transaction 1 creates the account, the mail is sent outside any transaction, and a failed send
 * is undone by transaction 2, so a refused invitation leaves nothing behind (US1-4).
 */
export const inviteAccount = async (
  deps: InviteAccountDeps,
  rawEmail: string,
): Promise<InviteOutcome> => {
  const { store, clock, crypto, hasher, ids, mailer, errorReporter } = deps;
  const email = normalizeEmail(rawEmail);
  if (email === null) return { kind: 'invalidEmail' };

  const temporaryPassword = crypto.generateTemporaryPassword();
  const temporaryPasswordHash = await hasher.hash(
    normalizeTemporaryPassword(temporaryPassword),
  );
  const nowMs = clock.nowMs();
  const expiresAt = temporaryExpiresAt(nowMs);

  const created = await store.run(async ({ accounts }) => {
    if ((await accounts.findByEmail(email)) !== null) return null;
    const record: AccountRecord = {
      id: ids.next(),
      email,
      role: 'user',
      passwordHash: null,
      temporaryPasswordHash,
      temporaryExpiresAt: expiresAt,
      suspendedAt: null,
      createdAt: new Date(nowMs).toISOString(),
    };
    await accounts.add(record);
    return record;
  });
  if (created === null) return { kind: 'exists' };

  try {
    await mailer.send({
      kind: 'invitation',
      to: email,
      temporaryPassword,
      expiresAt,
      serverUrl: deps.publicUrl,
    });
  } catch (error) {
    await store.run(({ accounts }) => accounts.delete(created.id));
    // Only the fixed error of the mail adapter, and the opaque id: no address (FR-020).
    errorReporter.report(
      error instanceof MailFailedError ? error : new MailFailedError(),
      {
        operation: 'inviteAccount',
        route: 'POST /v1/admin/accounts',
        accountId: created.id,
      },
    );
    return { kind: 'mailFailed' };
  }
  return { kind: 'invited', account: summaryOf(created, null, nowMs) };
};
