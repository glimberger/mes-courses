import { ok, type Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type { LocalDataEraser } from '../ports/local-data-eraser';

/**
 * The user dismissed the "signed out by the server" message (US5-4, US6-5, FR-017): the replica
 * is erased and the device returns to a first launch, so the connection is `notConnected`. The
 * credential goes first: if the erasure fails, the address with no credential still reads as
 * signed out and the message comes back.
 */
export const createAcknowledgeSignedOut =
  (deps: { credentials: CredentialStore; localDataEraser: LocalDataEraser }) =>
  async (): Promise<Result<void, never>> => {
    await deps.credentials.clear();
    await deps.localDataEraser.erase();
    return ok(undefined);
  };
