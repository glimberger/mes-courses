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
    migrate(db);
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
    migrate(db);
    const second = db.get<Row>('SELECT * FROM meta');
    const other = openMemory();
    migrate(other);

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
    migrate(db);

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

  describe('device.name', () => {
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
