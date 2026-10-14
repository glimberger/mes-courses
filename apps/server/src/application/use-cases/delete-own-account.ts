import { deleteAccountIn } from './delete-account';
import {
  withCurrentPassword,
  type OwnAccountDeps,
  type PasswordCheckFailure,
} from './change-password';

export type DeleteOwnAccountOutcome =
  { kind: 'deleted' } | { kind: 'lastAdministrator' } | PasswordCheckFailure;

/**
 * Deletes the caller's own account after checking their password, in one transaction (FR-016,
 * US6-6). A wrong password is returned as an outcome so its attempt is kept; the last active
 * administrator is refused (US6-7).
 */
export const deleteOwnAccount = (
  deps: OwnAccountDeps,
  request: { accountId: string; password: string; clientAddress: string },
): Promise<DeleteOwnAccountOutcome> =>
  withCurrentPassword(
    deps,
    request,
    async () => null,
    async (repos, account): Promise<DeleteOwnAccountOutcome> => {
      const outcome = await deleteAccountIn(deps, repos, account.id);
      return outcome.kind === 'deleted'
        ? outcome
        : { kind: 'lastAdministrator' };
    },
  );
