import type { Clock } from '../application/ports/clock';
import type { PairingCrypto } from '../application/ports/pairing-crypto';
import { createPairingCode } from '../application/use-cases/create-pairing-code';
import { systemClock } from '../adapters/clock/system-clock';
import { createPairingCrypto, systemRandom } from '../adapters/crypto/crypto';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import { databasePath } from './config';

/**
 * The Pi command: opens the database, creates a code with `created_by = NULL` (research R11) and
 * returns the line to print. English technical output for the maintainer, not user-facing text.
 */
export const pairingCodeLine = async ({
  path,
  clock = systemClock,
  crypto = createPairingCrypto(systemRandom),
}: {
  path: string;
  clock?: Clock;
  crypto?: PairingCrypto;
}): Promise<string> => {
  const db = openDatabase(path);
  try {
    const { code } = await createPairingCode(
      { store: new SqliteStore(db), clock, crypto },
      null,
    );
    return `pairing code: ${code} (valid for 10 minutes)`;
  } finally {
    db.close();
  }
};

if (require.main === module) {
  pairingCodeLine({ path: databasePath(process.env) }).then(
    (line) => console.log(line),
    (error: unknown) => {
      console.error(
        `could not create a pairing code: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      process.exitCode = 1;
    },
  );
}
