/**
 * What to do with the data already on this device when an account signs in (004 research R11):
 * keep it for the same account, keep an anonymous copy the account will adopt, erase anything else.
 * A copy tied to a server but to no known account (a device paired before accounts that has not
 * synced since) is erased: nothing says whose it is.
 */
export type LocalCopyDecision = 'keep' | 'erase';

export const decideLocalCopy = (
  copyAccountId: string | null,
  copyServerUrl: string | null,
  signingInAccountId: string,
): LocalCopyDecision => {
  if (copyAccountId === signingInAccountId) return 'keep';
  if (copyAccountId === null && copyServerUrl === null) return 'keep';
  return 'erase';
};
