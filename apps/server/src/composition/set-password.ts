import { systemRandom } from '../adapters/crypto/crypto';
import { createPasswordHasher } from '../adapters/crypto/password-hasher';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import {
  askNewPasswordHash,
  CommandError,
  requireEmail,
  terminalPrompt,
} from './admin-prompt';
import type { AdminCommandDeps } from './create-admin';
import { databasePath } from './config';

/**
 * Sets the password of an existing account and clears its temporary one (research R17), for the
 * maintainer who is locked out. Role, suspension and devices are untouched. Changes nothing when
 * it refuses.
 */
export const setPassword = async (
  { store, hasher, prompt }: AdminCommandDeps,
  rawEmail: string,
): Promise<string> => {
  const email = requireEmail(rawEmail);
  // An account without an address (the setup account before create-admin) can never match.
  const found = await store.run(({ accounts }) => accounts.findByEmail(email));
  if (found === null) throw new CommandError('no account has this address');
  const passwordHash = await askNewPasswordHash(prompt, hasher);

  await store.run(async ({ accounts }) => {
    const account = await accounts.findByEmail(email);
    if (account === null) throw new CommandError('no account has this address');
    await accounts.update({
      ...account,
      passwordHash,
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
    });
  });
  return `password set for ${email}`;
};

if (require.main === module) {
  const [rawEmail] = process.argv.slice(2);
  if (rawEmail === undefined) {
    console.error('usage: set-password <email>');
    process.exitCode = 1;
  } else {
    const db = openDatabase(databasePath(process.env));
    setPassword(
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
          `could not set the password: ${error instanceof CommandError ? error.message : 'unexpected error'}`,
        );
        process.exitCode = 1;
      })
      .finally(() => db.close());
  }
}
