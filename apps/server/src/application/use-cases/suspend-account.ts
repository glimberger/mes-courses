import { canLoseAdministrator } from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { ServerStore } from '../ports/store';

export type SuspendAccountDeps = { store: ServerStore; clock: Clock };

export type SuspendOutcome =
  { kind: 'suspended' } | { kind: 'notFound' } | { kind: 'lastAdministrator' };

/**
 * Stops an account from signing in or syncing; its data and devices are kept (FR-013). Suspending
 * a suspended account changes nothing. The last active administrator cannot be suspended.
 */
export const suspendAccount = async (
  { store, clock }: SuspendAccountDeps,
  id: string,
): Promise<SuspendOutcome> =>
  store.run(async ({ accounts }): Promise<SuspendOutcome> => {
    const account = await accounts.get(id);
    if (account === null) return { kind: 'notFound' };
    if (account.suspendedAt !== null) return { kind: 'suspended' };
    if (
      !canLoseAdministrator(
        account,
        await accounts.countOtherActiveAdministrators(id),
      )
    ) {
      return { kind: 'lastAdministrator' };
    }
    await accounts.update({
      ...account,
      suspendedAt: new Date(clock.nowMs()).toISOString(),
    });
    return { kind: 'suspended' };
  });
