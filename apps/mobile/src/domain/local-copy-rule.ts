/**
 * What to do with the data already on this device when an account signs in (004 research R11):
 * keep it for the same account, keep an anonymous copy the account will adopt, erase anything else.
 * A copy paired with a server but tied to no known account (a device paired before accounts that
 * has not synced since) is erased: nothing says whose it is. The pairing is the device id (013).
 */
export type LocalCopyDecision = 'keep' | 'erase';

export const decideLocalCopy = (
  copyAccountId: string | null,
  copyDeviceId: string | null,
  signingInAccountId: string,
): LocalCopyDecision => {
  if (copyAccountId === signingInAccountId) return 'keep';
  if (copyAccountId === null && copyDeviceId === null) return 'keep';
  return 'erase';
};
