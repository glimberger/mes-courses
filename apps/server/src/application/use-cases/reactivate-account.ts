import type { ServerStore } from '../ports/store';

export type ReactivateOutcome = { kind: 'reactivated' } | { kind: 'notFound' };

/**
 * Lifts a suspension and nothing else: the account returns to invited or active as it was, and its
 * devices sync again with no new sign-in. On an account that is not suspended it does nothing.
 */
export const reactivateAccount = async (
  { store }: { store: ServerStore },
  id: string,
): Promise<ReactivateOutcome> =>
  store.run(async ({ accounts }): Promise<ReactivateOutcome> => {
    const account = await accounts.get(id);
    if (account === null) return { kind: 'notFound' };
    if (account.suspendedAt !== null) {
      await accounts.update({ ...account, suspendedAt: null });
    }
    return { kind: 'reactivated' };
  });
