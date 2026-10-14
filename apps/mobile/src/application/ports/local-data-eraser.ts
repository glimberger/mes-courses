/**
 * Puts the device back to a first launch (004 research R11): every row of the data tables, the
 * outbox and `sync_state` is deleted and the seed of 001 R18 is created again, in one transaction.
 * After it `accountId` and `serverUrl` are null. Used when another account signs in, when the
 * account was deleted, and on sign-out.
 */
export interface LocalDataEraser {
  erase(): Promise<void>;
}
