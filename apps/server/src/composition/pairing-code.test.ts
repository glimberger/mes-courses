import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPairingCrypto, systemRandom } from '../adapters/crypto/crypto';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import { pairingCodeLine } from './pairing-code';

describe('pairing-code command', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mes-courses-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('prints exactly the line the maintainer expects', async () => {
    const line = await pairingCodeLine({ path: join(dir, 'db', 'x.db') });

    expect(line).toMatch(
      /^pairing code: [A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4} \(valid for 10 minutes\)$/,
    );
  });

  it('stores the code hashed, with no creator', async () => {
    const path = join(dir, 'x.db');
    const line = await pairingCodeLine({ path });
    const code = /pairing code: (\S+)/.exec(line)?.[1] ?? '';
    expect(code).not.toBe('');

    const db = openDatabase(path);
    try {
      const stored = await new SqliteStore(db).run(({ pairingCodes }) =>
        pairingCodes.findByHash(
          createPairingCrypto(systemRandom).sha256Hex(code),
        ),
      );
      expect(stored).toEqual(
        expect.objectContaining({ createdBy: null, usedAt: null }),
      );
    } finally {
      db.close();
    }
  });
});
