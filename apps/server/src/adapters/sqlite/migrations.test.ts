import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS, migrate } from './migrations';
import { NodeSqlDatabase } from './open-database';

type Row = Record<string, unknown>;

const openMemory = () => new NodeSqlDatabase(new DatabaseSync(':memory:'));

const names = (db: NodeSqlDatabase, type: 'table' | 'index'): string[] =>
  db
    .all<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      [type],
    )
    .map((row) => row.name);

const sqlOf = (db: NodeSqlDatabase, name: string): string =>
  db.get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE name = ?`, [
    name,
  ])?.sql ?? '';

describe('server migrations', () => {
  let db: NodeSqlDatabase;

  beforeEach(() => {
    db = openMemory();
    migrate(db, MIGRATIONS.slice(0, 1));
  });

  afterEach(() => db.close());

  it('migration 1 creates exactly the tables of the data model', () => {
    expect(names(db, 'table')).toEqual([
      'applied_change',
      'article',
      'category',
      'device',
      'list_item',
      'meta',
      'pairing_code',
      'pairing_failure',
      'shopping_list',
    ]);
  });

  it('migration 1 creates exactly the indexes of the data model', () => {
    expect(names(db, 'index')).toEqual(
      expect.arrayContaining([
        'article_live_name',
        'article_seq',
        'category_live_name',
        'category_seq',
        'list_item_seq',
        'list_live_name',
        'list_seq',
      ]),
    );
    // The other indexes are the ones SQLite creates for primary keys and UNIQUE constraints.
    expect(
      names(db, 'index').filter((name) => !name.startsWith('sqlite_autoindex')),
    ).toEqual([
      'article_live_name',
      'article_seq',
      'category_live_name',
      'category_seq',
      'list_item_seq',
      'list_live_name',
      'list_seq',
      'pairing_failure_at',
    ]);
  });

  it.each(['category_live_name', 'article_live_name', 'list_live_name'])(
    '%s is a partial unique index on live rows',
    (index) => {
      const sql = sqlOf(db, index);

      expect(sql).toMatch(/UNIQUE INDEX/);
      expect(sql).toMatch(/\(normalized_name\) WHERE deleted_hlc IS NULL/);
    },
  );

  it('lets a tombstoned row share a normalized name with a live one', () => {
    const insert = (id: string, deleted: string | null) =>
      db.run(
        `INSERT INTO category (id, name, name_hlc, normalized_name, position, position_hlc, created_hlc, deleted_hlc, seq)
         VALUES (?, 'Lait', 'h', 'lait', 0, 'h', 'h', ?, 1)`,
        [id, deleted],
      );

    insert('c-1', 'h');
    insert('c-2', null);

    expect(() => insert('c-3', null)).toThrow(/UNIQUE/);
  });

  it('gives meta a random server id once', () => {
    const first = db.get<Row>('SELECT * FROM meta');
    migrate(db, MIGRATIONS.slice(0, 1));
    const second = db.get<Row>('SELECT * FROM meta');
    const other = openMemory();
    migrate(other, MIGRATIONS.slice(0, 1));

    expect(first).toEqual({
      id: 1,
      server_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      seq: 0,
    });
    expect(second).toEqual(first);
    expect(other.get<Row>('SELECT server_id FROM meta')).not.toEqual({
      server_id: first?.server_id,
    });
    other.close();
  });

  it('sets user_version to 1, and running again is a no-op', () => {
    const version = () =>
      db.get<{ user_version: number }>('PRAGMA user_version');
    expect(version()).toEqual({ user_version: 1 });

    const before = names(db, 'table');
    migrate(db, MIGRATIONS.slice(0, 1));

    expect(version()).toEqual({ user_version: 1 });
    expect(names(db, 'table')).toEqual(before);
  });

  it('refuses a database written by a newer version', () => {
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);

    expect(() => migrate(db)).toThrow(/newer/);
  });

  it('rolls a failing migration back', () => {
    const fresh = openMemory();

    expect(() =>
      migrate(fresh, [
        (database) => database.exec('CREATE TABLE a (id INTEGER)'),
        (database) => {
          database.exec('CREATE TABLE b (id INTEGER)');
          throw new Error('boom');
        },
      ]),
    ).toThrow('boom');

    expect(names(fresh, 'table')).toEqual(['a']);
    expect(fresh.get('PRAGMA user_version')).toEqual({ user_version: 1 });
    fresh.close();
  });

  describe('migration 1 device.name', () => {
    const insert = (name: string) =>
      db.run(
        `INSERT INTO device (id, name, credential_hash, created_at) VALUES ('d-1', ?, 'h-1', 't')`,
        [name],
      );

    it('rejects 0 and 61 characters', () => {
      expect(() => insert('')).toThrow(/CHECK/);
      expect(() => insert('x'.repeat(61))).toThrow(/CHECK/);
    });

    it('accepts 1 and 60 characters', () => {
      expect(() => insert('x')).not.toThrow();
      db.run(`DELETE FROM device`);
      expect(() => insert('x'.repeat(60))).not.toThrow();
    });
  });
});

const HLC = '000000000001:0000:d-1';

/** A database as migration 1 and 003's code leave it, with one of everything. */
const database003 = (): NodeSqlDatabase => {
  const old = openMemory();
  old.exec('PRAGMA foreign_keys = ON');
  migrate(old, MIGRATIONS.slice(0, 1));
  old.exec(`
    UPDATE meta SET seq = 7;
    INSERT INTO category (id, name, name_hlc, normalized_name, position, position_hlc, created_hlc, deleted_hlc, merged_into, seq)
      VALUES ('c-1', 'Crèmerie', '${HLC}', 'crèmerie', 0, '${HLC}', '${HLC}', NULL, NULL, 3),
             ('c-2', 'Laiterie', '${HLC}', 'laiterie', 1, '${HLC}', '${HLC}', '${HLC}', 'c-1', 4);
    INSERT INTO article (id, name, name_hlc, normalized_name, category_id, category_hlc, created_hlc, deleted_hlc, merged_into, seq)
      VALUES ('a-1', 'Lait', '${HLC}', 'lait', 'c-1', '${HLC}', '${HLC}', NULL, NULL, 5),
             ('a-0', 'Lait ancien', '${HLC}', 'lait ancien', 'c-1', '${HLC}', '${HLC}', '${HLC}', 'a-1', 6);
    INSERT INTO shopping_list (id, name, name_hlc, normalized_name, created_hlc, deleted_hlc, merged_into, seq)
      VALUES ('l-1', 'Ma liste', '${HLC}', 'ma liste', '${HLC}', NULL, NULL, 2);
    INSERT INTO list_item (list_id, article_id, present, present_hlc, in_cart, in_cart_hlc, quantity_amount, quantity_unit, quantity_hlc, seq)
      VALUES ('l-1', 'a-1', 1, '${HLC}', 0, '${HLC}', 2, 'L', '${HLC}', 7);
    INSERT INTO applied_change (change_id, device_id, applied_at) VALUES ('ch-1', 'd-1', '2026-09-01T10:00:00.000Z');
    INSERT INTO device (id, name, credential_hash, created_at, last_sync_at, revoked_at)
      VALUES ('d-1', 'Téléphone', 'hash-1', '2026-09-01T09:00:00.000Z', '2026-09-30T09:00:00.000Z', NULL),
             ('d-2', 'Tablette', 'hash-2', '2026-09-02T09:00:00.000Z', NULL, '2026-09-03T09:00:00.000Z');
    INSERT INTO pairing_code (code_hash, created_by, expires_at, used_at)
      VALUES ('code-1', 'd-1', '2026-09-01T09:10:00.000Z', NULL);
  `);
  return old;
};

describe('server migration 2 (accounts)', () => {
  const fixedEnv = {
    newId: () => 'setup-account',
    now: () => '2026-10-12T10:00:00.000Z',
  };
  let db: NodeSqlDatabase;

  afterEach(() => db.close());

  describe('on a database filled by migration 1 and 003', () => {
    beforeEach(() => {
      db = database003();
      migrate(db, MIGRATIONS, fixedEnv);
    });

    it('004 SC-005 creates exactly one passwordless administrator without an email', () => {
      expect(db.all<Row>('SELECT * FROM account')).toEqual([
        {
          id: 'setup-account',
          email: null,
          role: 'administrator',
          password_hash: null,
          temporary_password_hash: null,
          temporary_expires_at: null,
          suspended_at: null,
          created_at: '2026-10-12T10:00:00.000Z',
        },
      ]);
    });

    it('004 SC-005 gives every row, applied change and device to that account', () => {
      for (const table of [
        'category',
        'article',
        'shopping_list',
        'list_item',
        'applied_change',
        'device',
      ]) {
        expect(
          db.get<{ other: number }>(
            `SELECT COUNT(*) AS other FROM ${table} WHERE account_id != 'setup-account'`,
          )?.other,
        ).toBe(0);
      }
      expect(
        db.get<{ n: number }>('SELECT COUNT(*) AS n FROM category')?.n,
      ).toBe(2);
      expect(
        db.get<{ n: number }>('SELECT COUNT(*) AS n FROM article')?.n,
      ).toBe(2);
      expect(
        db.get<{ n: number }>('SELECT COUNT(*) AS n FROM list_item')?.n,
      ).toBe(1);
      expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM device')?.n).toBe(
        2,
      );
      expect(
        db.get<{ n: number }>('SELECT COUNT(*) AS n FROM applied_change')?.n,
      ).toBe(1);
    });

    it('004 SC-005 keeps ids, seq values and the server id', () => {
      expect(db.get<Row>('SELECT seq FROM meta')).toEqual({ seq: 7 });
      expect(
        db.all<Row>('SELECT id, seq, merged_into FROM category ORDER BY id'),
      ).toEqual([
        { id: 'c-1', seq: 3, merged_into: null },
        { id: 'c-2', seq: 4, merged_into: 'c-1' },
      ]);
      expect(db.get<Row>('SELECT seq, quantity_unit FROM list_item')).toEqual({
        seq: 7,
        quantity_unit: 'L',
      });
    });

    it('004 SC-005 leaves no foreign key violation, sets user_version to 2, and running again is a no-op', () => {
      expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
      expect(db.get('PRAGMA user_version')).toEqual({ user_version: 2 });

      migrate(db, MIGRATIONS, fixedEnv);

      expect(db.get('PRAGMA user_version')).toEqual({ user_version: 2 });
      expect(db.all('SELECT id FROM account')).toHaveLength(1);
    });

    it('004 SC-005 still knows a 003 device credential, under the setup account', () => {
      expect(
        db.get<Row>(
          `SELECT id, account_id FROM device WHERE credential_hash = 'hash-1'`,
        ),
      ).toEqual({ id: 'd-1', account_id: 'setup-account' });
    });

    it('004 drops the pairing tables', () => {
      expect(names(db, 'table')).not.toEqual(
        expect.arrayContaining(['pairing_code']),
      );
      expect(names(db, 'table')).not.toEqual(
        expect.arrayContaining(['pairing_failure']),
      );
    });
  });

  describe('on a fresh database', () => {
    beforeEach(() => {
      db = openMemory();
      db.exec('PRAGMA foreign_keys = ON');
      migrate(db, MIGRATIONS, fixedEnv);
    });

    it('004 takes the same path: the setup account exists and the tables are those of the data model', () => {
      expect(db.all<Row>('SELECT id, email FROM account')).toEqual([
        { id: 'setup-account', email: null },
      ]);
      expect(names(db, 'table')).toEqual([
        'account',
        'applied_change',
        'article',
        'auth_attempt',
        'category',
        'device',
        'ended_credential',
        'list_item',
        'meta',
        'shopping_list',
      ]);
      expect(
        names(db, 'index').filter(
          (name) => !name.startsWith('sqlite_autoindex'),
        ),
      ).toEqual([
        'article_live_name',
        'article_seq',
        'auth_attempt_key',
        'category_live_name',
        'category_seq',
        'device_account',
        'list_item_seq',
        'list_live_name',
        'list_seq',
      ]);
    });

    it('004 makes the live-name indexes unique per account', () => {
      for (const [index, columns] of [
        ['category_live_name', '(account_id, normalized_name)'],
        ['article_live_name', '(account_id, normalized_name)'],
        ['list_live_name', '(account_id, normalized_name)'],
      ]) {
        const sql = sqlOf(db, index ?? '');
        expect(sql).toMatch(/UNIQUE INDEX/);
        expect(sql).toContain(`${columns} WHERE deleted_hlc IS NULL`);
      }
    });

    const addAccount = (id: string, email: string | null, extra = '') =>
      db.run(
        `INSERT INTO account (id, email, role, created_at ${extra ? ', ' + extra.split('=')[0] : ''})
         VALUES (?, ?, 'user', 't' ${extra ? ', ' + extra.split('=')[1] : ''})`,
        [id, email],
      );
    const addCategory = (account: string, id: string, name = 'Lait') =>
      db.run(
        `INSERT INTO category (account_id, id, name, name_hlc, normalized_name, position, position_hlc, created_hlc, seq)
         VALUES (?, ?, ?, 'h', ?, 0, 'h', 'h', 1)`,
        [account, id, name, name.toLowerCase()],
      );

    it('004 lets two accounts hold the same id and the same live name', () => {
      addAccount('a-1', 'a@example.org');
      addAccount('a-2', 'b@example.org');

      addCategory('a-1', 'c-1');
      expect(() => addCategory('a-2', 'c-1')).not.toThrow();
      expect(() => addCategory('a-1', 'c-2')).toThrow(/UNIQUE/);
    });

    it('004 refuses a row that points at another account row', () => {
      addAccount('a-1', 'a@example.org');
      addAccount('a-2', 'b@example.org');
      addCategory('a-1', 'c-1');

      expect(() =>
        db.run(
          `INSERT INTO article (account_id, id, name, name_hlc, normalized_name, category_id, category_hlc, created_hlc, seq)
           VALUES ('a-2', 'ar-1', 'Lait', 'h', 'lait', 'c-1', 'h', 'h', 1)`,
        ),
      ).toThrow(/FOREIGN KEY/);
    });

    it('004 FR-001 refuses a second account with the same email', () => {
      addAccount('a-1', 'a@example.org');

      expect(() => addAccount('a-2', 'a@example.org')).toThrow(/UNIQUE/);
    });

    it('004 R2 refuses an account without an email unless it is the passwordless administrator', () => {
      expect(() => addAccount('a-1', null)).toThrow(/CHECK/);
      expect(() =>
        db.run(
          `INSERT INTO account (id, email, role, password_hash, created_at) VALUES ('a-2', NULL, 'administrator', 'h', 't')`,
        ),
      ).toThrow(/CHECK/);
    });

    it('004 refuses a temporary hash without an expiry, and the reverse', () => {
      expect(() =>
        db.run(
          `INSERT INTO account (id, email, role, temporary_password_hash, created_at) VALUES ('a-1', 'a@example.org', 'user', 't', 't')`,
        ),
      ).toThrow(/CHECK/);
      expect(() =>
        db.run(
          `INSERT INTO account (id, email, role, temporary_expires_at, created_at) VALUES ('a-2', 'b@example.org', 'user', 't', 't')`,
        ),
      ).toThrow(/CHECK/);
    });

    it('004 refuses an unknown role and an unknown attempt or ended-credential kind', () => {
      expect(() =>
        db.run(
          `INSERT INTO account (id, email, role, created_at) VALUES ('a-1', 'a@example.org', 'root', 't')`,
        ),
      ).toThrow(/CHECK/);
      expect(() =>
        db.run(
          `INSERT INTO auth_attempt (kind, key_hash, at) VALUES ('other', 'k', 't')`,
        ),
      ).toThrow(/CHECK/);
      expect(() =>
        db.run(
          `INSERT INTO ended_credential (credential_hash, reason, ended_at) VALUES ('h', 'other', 't')`,
        ),
      ).toThrow(/CHECK/);
    });

    it('004 FR-016 deleting an account cascades to every table', () => {
      addAccount('a-1', 'a@example.org');
      addCategory('a-1', 'c-1');
      db.run(
        `INSERT INTO article (account_id, id, name, name_hlc, normalized_name, category_id, category_hlc, created_hlc, seq)
         VALUES ('a-1', 'ar-1', 'Lait', 'h', 'lait', 'c-1', 'h', 'h', 1)`,
      );
      db.run(
        `INSERT INTO shopping_list (account_id, id, name, name_hlc, normalized_name, created_hlc, seq)
         VALUES ('a-1', 'l-1', 'Liste', 'h', 'liste', 'h', 1)`,
      );
      db.run(
        `INSERT INTO list_item (account_id, list_id, article_id, present, present_hlc, in_cart, in_cart_hlc, quantity_hlc, seq)
         VALUES ('a-1', 'l-1', 'ar-1', 1, 'h', 0, 'h', 'h', 1)`,
      );
      db.run(
        `INSERT INTO applied_change (account_id, change_id, device_id, applied_at) VALUES ('a-1', 'ch-1', 'd-1', 't')`,
      );
      db.run(
        `INSERT INTO device (id, account_id, name, credential_hash, created_at) VALUES ('d-1', 'a-1', 'Tel', 'h-1', 't')`,
      );

      db.run(`DELETE FROM account WHERE id = 'a-1'`);

      for (const table of [
        'category',
        'article',
        'shopping_list',
        'list_item',
        'applied_change',
        'device',
      ]) {
        expect(
          db.get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM ${table} WHERE account_id = 'a-1'`,
          )?.n,
        ).toBe(0);
      }
    });

    it('004 gives created_at no default: it is required', () => {
      expect(() =>
        db.run(
          `INSERT INTO account (id, email, role) VALUES ('a-1', 'a@example.org', 'user')`,
        ),
      ).toThrow(/NOT NULL/);
    });

    it('004 uses a random id and the current time when no environment is given', () => {
      const other = openMemory();
      migrate(other);
      const row = other.get<{ id: string; created_at: string }>(
        'SELECT id, created_at FROM account',
      );
      expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(Number.isNaN(Date.parse(row?.created_at ?? ''))).toBe(false);
      other.close();
    });
  });
});
