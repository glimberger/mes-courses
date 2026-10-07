import { DataFromNewerVersion } from '../../application/ports/data-from-newer-version';
import { StorageFull } from '../../application/ports/storage-full';

const SQLITE_FULL = 13;
const FULL_MESSAGE = 'database or disk is full';

/**
 * A database failure, with a fixed message and the SQLite result code when there is one. The
 * original error is dropped, message, stack and cause included, so no stored value can reach a
 * report (FR-030, research R13).
 */
export class StorageError extends Error {
  // Set only when there is a code. Babel strips a field with no value, so none is created here.
  readonly code?: number;

  constructor(code?: number) {
    super('Storage operation failed');
    this.name = 'StorageError';
    if (code !== undefined) Object.assign(this, { code });
  }
}

/**
 * The primary SQLite result code: `errcode` from `node:sqlite`, or "Error code N" in the message
 * of expo-sqlite. Extended codes keep their low byte (2067, a unique constraint, gives 19).
 */
const resultCode = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { errcode, message } = error as {
    errcode?: unknown;
    message?: unknown;
  };
  if (typeof errcode === 'number') return errcode & 0xff;
  const match =
    typeof message === 'string' ? /Error code (\d+)/u.exec(message) : null;
  return match ? Number(match[1]) & 0xff : undefined;
};

const isFull = (error: unknown, code: number | undefined) =>
  code === SQLITE_FULL ||
  (error instanceof Error && error.message.includes(FULL_MESSAGE));

/**
 * `StorageFull` for a full storage (R12a), checked before the text is dropped, a `StorageError`
 * for any other failure. `DataFromNewerVersion` and errors already converted pass unchanged.
 */
export const toStorageError = (error: unknown): Error => {
  if (
    error instanceof StorageError ||
    error instanceof StorageFull ||
    error instanceof DataFromNewerVersion
  ) {
    return error;
  }
  const code = resultCode(error);
  return isFull(error, code) ? new StorageFull() : new StorageError(code);
};

/** Runs a database call, rethrowing its failure through `toStorageError`. */
export const withStorageErrors = async <T>(
  call: () => Promise<T>,
): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw toStorageError(error);
  }
};
