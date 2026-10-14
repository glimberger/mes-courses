import { systemRandom } from '../adapters/crypto/crypto';
import { createPasswordHasher } from '../adapters/crypto/password-hasher';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import type { PasswordHasher } from '../application/ports/password-hasher';
import type { ServerStore } from '../application/ports/store';
import {
  askNewPasswordHash,
  CommandError,
  requireEmail,
  terminalPrompt,
  type PasswordPrompt,
} from './admin-prompt';
import { databasePath } from './config';

export type AdminCommandDeps = {
  store: ServerStore;
  hasher: PasswordHasher;
  prompt: PasswordPrompt;
};

/**
 * Completes the setup account, the one migration 2 made without an address or a password
 * (research R2): stores the normalized address and the password hash. Changes nothing when it
 * refuses. English technical output: it is a maintainer tool.
 */
export const createAdmin = async (
  { store, hasher, prompt }: AdminCommandDeps,
  rawEmail: string,
): Promise<string> => {
  const email = requireEmail(rawEmail);
  const passwordHash = await askNewPasswordHash(prompt, hasher);

  await store.run(async ({ accounts }) => {
    const setup = (await accounts.all()).find(
      (account) => account.email === null,
    );
    if (setup === undefined) {
      throw new CommandError('the setup account already has an address');
    }
    if ((await accounts.findByEmail(email)) !== null) {
      throw new CommandError('an account already uses this address');
    }
    await accounts.update({ ...setup, email, passwordHash });
  });
  return `administrator account ready: ${email}`;
};

if (require.main === module) {
  const [rawEmail] = process.argv.slice(2);
  if (rawEmail === undefined) {
    console.error('usage: create-admin <email>');
    process.exitCode = 1;
  } else {
    const db = openDatabase(databasePath(process.env));
    createAdmin(
      {
        store: new SqliteStore(db),
        hasher: createPasswordHasher(systemRandom),
        prompt: terminalPrompt(),
      },
      rawEmail,
    )
      .then((line) => console.log(line))
      .catch((error: unknown) => {
        console.error(
          `could not create the administrator: ${error instanceof CommandError ? error.message : 'unexpected error'}`,
        );
        process.exitCode = 1;
      })
      .finally(() => db.close());
  }
}
