/** @jest-environment node */
import { DataFromNewerVersion } from '../../application/ports/data-from-newer-version';
import { NodeSqlDatabase } from '../../../test/sqlite/node-sql-database';
import { encodeHlc, minHlc } from '@mes-courses/sync-core';
import { MIGRATIONS, migrate, type Migration } from './migrations';

const LOCAL_STAMP = encodeHlc(minHlc('local'));

type SchemaRow = { type: string; name: string; tbl_name: string };

const schema = async (db: NodeSqlDatabase) =>
  (
    await db.getAllAsync<SchemaRow>(
      `SELECT type, name, tbl_name FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
      [],
    )
  ).map((row) => ({ ...row }));

const userVersion = async (db: NodeSqlDatabase) =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))
    ?.user_version;

const columns = async (db: NodeSqlDatabase, table: string) =>
  (
    await db.getAllAsync<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>(
      `SELECT name, type, "notnull", pk FROM pragma_table_info(?) ORDER BY cid`,
      [table],
    )
  ).map((column) => ({ ...column }));

describe('migrate', () => {
  let db: NodeSqlDatabase;

  beforeEach(() => {
    db = new NodeSqlDatabase();
  });

  afterEach(() => {
    db.close();
  });

  const fillMigrated = async () => {
    await migrate(db);
    await db.runAsync(
      `INSERT INTO category (id, name, normalized_name, position) VALUES ('c-1', 'Crèmerie', 'crèmerie', 0)`,
      [],
    );
    await db.runAsync(
      `INSERT INTO article (id, name, normalized_name, category_id) VALUES ('a-1', 'Lait', 'lait', 'c-1')`,
      [],
    );
    await db.runAsync(
      `INSERT INTO shopping_list (id, name, normalized_name) VALUES ('l-1', 'Ma liste', 'ma liste')`,
      [],
    );
    await db.runAsync(
      `INSERT INTO list_item (list_id, article_id, in_cart, quantity_amount, quantity_unit)
       VALUES ('l-1', 'a-1', 1, 2, 'L')`,
      [],
    );
    await db.runAsync(
      `INSERT INTO app_state (id, current_list_id) VALUES (1, 'l-1')`,
      [],
    );
  };

  const storedRows = async () => ({
    categories: (await db.getAllAsync('SELECT * FROM category', [])).map(
      (r) => ({ ...(r as object) }),
    ),
    articles: (await db.getAllAsync('SELECT * FROM article', [])).map((r) => ({
      ...(r as object),
    })),
    lists: (await db.getAllAsync('SELECT * FROM shopping_list', [])).map(
      (r) => ({ ...(r as object) }),
    ),
    items: (await db.getAllAsync('SELECT * FROM list_item', [])).map((r) => ({
      ...(r as object),
    })),
    appState: (await db.getAllAsync('SELECT * FROM app_state', [])).map(
      (r) => ({ ...(r as object) }),
    ),
  });

  it('migration 1 creates the tables and the index of the data model', async () => {
    await migrate(db, MIGRATIONS.slice(0, 1));

    expect(await schema(db)).toEqual([
      { type: 'index', name: 'list_item_article', tbl_name: 'list_item' },
      { type: 'table', name: 'app_state', tbl_name: 'app_state' },
      { type: 'table', name: 'article', tbl_name: 'article' },
      { type: 'table', name: 'category', tbl_name: 'category' },
      { type: 'table', name: 'list_item', tbl_name: 'list_item' },
      { type: 'table', name: 'shopping_list', tbl_name: 'shopping_list' },
    ]);
    expect(await columns(db, 'category')).toEqual([
      { name: 'id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'normalized_name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'position', type: 'INTEGER', notnull: 1, pk: 0 },
    ]);
    expect(await columns(db, 'article')).toEqual([
      { name: 'id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'normalized_name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'category_id', type: 'TEXT', notnull: 1, pk: 0 },
    ]);
    expect(await columns(db, 'shopping_list')).toEqual([
      { name: 'id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'normalized_name', type: 'TEXT', notnull: 1, pk: 0 },
    ]);
    expect(await columns(db, 'list_item')).toEqual([
      { name: 'list_id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'article_id', type: 'TEXT', notnull: 1, pk: 2 },
      { name: 'in_cart', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'quantity_amount', type: 'REAL', notnull: 0, pk: 0 },
      { name: 'quantity_unit', type: 'TEXT', notnull: 0, pk: 0 },
    ]);
    expect(await columns(db, 'app_state')).toEqual([
      { name: 'id', type: 'INTEGER', notnull: 0, pk: 1 },
      { name: 'current_list_id', type: 'TEXT', notnull: 1, pk: 0 },
    ]);
  });

  it('records the migration in user_version, and does nothing when run again', async () => {
    await fillMigrated();
    const before = await storedRows();

    expect(await userVersion(db)).toBe(MIGRATIONS.length);

    await migrate(db);

    expect(await userVersion(db)).toBe(MIGRATIONS.length);
    expect(await storedRows()).toEqual(before);
  });

  it('FR-039 rolls back a migration that fails halfway, keeping the version and the data', async () => {
    await fillMigrated();
    const before = await storedRows();
    const failingMigration: Migration = async (database) => {
      await database.execAsync('CREATE TABLE added_by_2 (id TEXT)');
      await database.runAsync('DELETE FROM list_item', []);
      throw new Error('migration 2 failed halfway');
    };

    await expect(
      migrate(db, [...MIGRATIONS, failingMigration]),
    ).rejects.toThrow();

    expect(await userVersion(db)).toBe(MIGRATIONS.length);
    expect(await storedRows()).toEqual(before);
    expect((await schema(db)).map((row) => row.name)).not.toContain(
      'added_by_2',
    );
  });

  it('FR-040 lets a later migration rebuild a table that other rows reference', async () => {
    await fillMigrated();
    const rebuildCategory: Migration = async (database) => {
      await database.execAsync(`
        CREATE TABLE category_new (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
          normalized_name TEXT NOT NULL UNIQUE,
          position        INTEGER NOT NULL
        );
        INSERT INTO category_new SELECT id, name, normalized_name, position FROM category;
        DROP TABLE category;
        ALTER TABLE category_new RENAME TO category;
      `);
    };

    await migrate(db, [...MIGRATIONS, rebuildCategory]);

    expect(await userVersion(db)).toBe(MIGRATIONS.length + 1);
    expect(
      await db.getFirstAsync('SELECT category_id FROM article', []),
    ).toEqual({ category_id: 'c-1' });
    expect(await db.getFirstAsync('PRAGMA foreign_keys', [])).toEqual({
      foreign_keys: 1,
    });
  });

  it('FR-039 rolls back a migration that leaves a row referencing nothing', async () => {
    await fillMigrated();
    const before = await storedRows();
    const breakingMigration: Migration = async (database) => {
      await database.runAsync('DELETE FROM category', []);
    };

    await expect(
      migrate(db, [...MIGRATIONS, breakingMigration]),
    ).rejects.toThrow();

    expect(await userVersion(db)).toBe(MIGRATIONS.length);
    expect(await storedRows()).toEqual(before);
  });

  it('FR-040 refuses data from a newer version before any other statement', async () => {
    await db.execAsync('PRAGMA user_version = 99');
    const executed: string[] = [];
    const recording = {
      execAsync: (source: string) => {
        executed.push(source);
        return db.execAsync(source);
      },
      runAsync: (source: string, params: (string | number | null)[]) => {
        executed.push(source);
        return db.runAsync(source, params);
      },
      getAllAsync: <T>(source: string, params: (string | number | null)[]) => {
        executed.push(source);
        return db.getAllAsync<T>(source, params);
      },
      getFirstAsync: <T>(
        source: string,
        params: (string | number | null)[],
      ) => {
        executed.push(source);
        return db.getFirstAsync<T>(source, params);
      },
      withTransactionAsync: (task: () => Promise<void>) => {
        executed.push('BEGIN');
        return db.withTransactionAsync(task);
      },
    };

    await expect(migrate(recording)).rejects.toBeInstanceOf(
      DataFromNewerVersion,
    );

    expect(executed).toEqual(['PRAGMA user_version']);
    expect(await schema(db)).toEqual([]);
    expect(await userVersion(db)).toBe(99);
  });

  it('enforces foreign constraints once migrated', async () => {
    await migrate(db);

    await expect(
      db.runAsync(
        `INSERT INTO article (id, name, normalized_name, category_id) VALUES ('a-1', 'Lait', 'lait', 'unknown')`,
        [],
      ),
    ).rejects.toThrow('FOREIGN KEY constraint failed');
  });

  describe('migration 2 (003 server synchronization)', () => {
    const migrateToVersion1 = () => migrate(db, MIGRATIONS.slice(0, 1));

    const seedVersion1 = async () => {
      await migrateToVersion1();
      await db.execAsync(`
        INSERT INTO category (id, name, normalized_name, position) VALUES ('c-1', 'Crèmerie', 'crèmerie', 0);
        INSERT INTO category (id, name, normalized_name, position) VALUES ('c-2', 'Divers', 'divers', 1);
        INSERT INTO article (id, name, normalized_name, category_id) VALUES ('a-1', 'Lait', 'lait', 'c-1');
        INSERT INTO shopping_list (id, name, normalized_name) VALUES ('l-1', 'Ma liste', 'ma liste');
        INSERT INTO list_item (list_id, article_id, in_cart, quantity_amount, quantity_unit) VALUES ('l-1', 'a-1', 1, 2, 'L');
        INSERT INTO app_state (id, current_list_id) VALUES (1, 'l-1');
      `);
    };

    const rows = async (table: string, order: string) =>
      (
        await db.getAllAsync(`SELECT * FROM ${table} ORDER BY ${order}`, [])
      ).map((r) => ({ ...(r as object) }));

    it('003 creates pending_change and sync_state as in the data model', async () => {
      await migrate(db);

      expect(await columns(db, 'pending_change')).toEqual([
        { name: 'seq', type: 'INTEGER', notnull: 0, pk: 1 },
        { name: 'change_id', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'hlc', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'kind', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'entity_id', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'fields', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'held_by', type: 'TEXT', notnull: 0, pk: 0 },
      ]);
      expect(await columns(db, 'sync_state')).toEqual([
        { name: 'id', type: 'INTEGER', notnull: 0, pk: 1 },
        { name: 'server_url', type: 'TEXT', notnull: 0, pk: 0 },
        { name: 'server_id', type: 'TEXT', notnull: 0, pk: 0 },
        { name: 'device_id', type: 'TEXT', notnull: 0, pk: 0 },
        { name: 'last_seq', type: 'INTEGER', notnull: 1, pk: 0 },
        { name: 'max_hlc', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'last_sync_at', type: 'TEXT', notnull: 0, pk: 0 },
        { name: 'snapshot_done', type: 'INTEGER', notnull: 1, pk: 0 },
      ]);
      expect((await schema(db)).map((row) => row.name)).toContain(
        'pending_change_held',
      );
    });

    it('003 restricts the kind of a pending change and snapshot_done', async () => {
      await migrate(db);
      const insertChange = (kind: string) =>
        db.runAsync(
          `INSERT INTO pending_change (change_id, hlc, kind, entity_id, fields)
           VALUES (?, 'h', ?, 'e', '{}')`,
          [`change-${kind}`, kind],
        );

      for (const kind of ['category', 'article', 'list', 'listItem']) {
        await expect(insertChange(kind)).resolves.toBeDefined();
      }
      await expect(insertChange('device')).rejects.toThrow(
        'CHECK constraint failed',
      );
      await expect(
        db.runAsync(
          `INSERT INTO sync_state (id, max_hlc, snapshot_done) VALUES (1, 'h', 2)`,
          [],
        ),
      ).rejects.toThrow('CHECK constraint failed');
    });

    it('003 refuses two changes with the same change id', async () => {
      await migrate(db);
      const insert = () =>
        db.runAsync(
          `INSERT INTO pending_change (change_id, hlc, kind, entity_id, fields)
           VALUES ('same', 'h', 'list', 'l-1', '{}')`,
          [],
        );
      await insert();

      await expect(insert()).rejects.toThrow('UNIQUE constraint failed');
    });

    it('003 lets two categories share a position', async () => {
      await migrate(db);
      await db.execAsync(`
        INSERT INTO category (id, name, normalized_name, position) VALUES ('c-1', 'A', 'a', 0);
        INSERT INTO category (id, name, normalized_name, position) VALUES ('c-2', 'B', 'b', 0);
      `);

      expect(
        await db.getAllAsync('SELECT id FROM category ORDER BY id', []),
      ).toHaveLength(2);
    });

    it('003 adds created_hlc, giving existing rows the minimum stamp', async () => {
      await seedVersion1();

      await migrate(db);

      for (const table of ['category', 'article', 'shopping_list']) {
        const created = (await columns(db, table)).find(
          (column) => column.name === 'created_hlc',
        );
        expect(created).toMatchObject({ type: 'TEXT', notnull: 1 });
        expect(
          (
            await db.getAllAsync<{ created_hlc: string }>(
              `SELECT created_hlc FROM ${table}`,
              [],
            )
          ).map((row) => row.created_hlc),
        ).toEqual(expect.arrayContaining([LOCAL_STAMP]));
        expect(
          await db.getAllAsync(
            `SELECT 1 FROM ${table} WHERE created_hlc <> ?`,
            [LOCAL_STAMP],
          ),
        ).toEqual([]);
      }
    });

    it('003 keeps existing rows and list items through the table rebuild', async () => {
      await seedVersion1();
      const strip = (list: object[]) =>
        list.map((row) => {
          const { created_hlc: _stamp, ...rest } = row as Record<
            string,
            unknown
          >;
          return rest;
        });
      const before = {
        categories: await rows('category', 'id'),
        articles: await rows('article', 'id'),
        lists: await rows('shopping_list', 'id'),
        items: await rows('list_item', 'list_id, article_id'),
        appState: await rows('app_state', 'id'),
      };

      await migrate(db);

      expect(strip(await rows('category', 'id'))).toEqual(before.categories);
      expect(strip(await rows('article', 'id'))).toEqual(before.articles);
      expect(strip(await rows('shopping_list', 'id'))).toEqual(before.lists);
      expect(await rows('list_item', 'list_id, article_id')).toEqual(
        before.items,
      );
      expect(await rows('app_state', 'id')).toEqual(before.appState);
      await expect(
        db.runAsync(
          `INSERT INTO article (id, name, normalized_name, category_id) VALUES ('a-2', 'Pain', 'pain', 'unknown')`,
          [],
        ),
      ).rejects.toThrow('FOREIGN KEY constraint failed');
    });

    it('003 keeps the other category constraints', async () => {
      await migrate(db);
      await db.runAsync(
        `INSERT INTO category (id, name, normalized_name, position) VALUES ('c-1', 'Crèmerie', 'crèmerie', 0)`,
        [],
      );

      await expect(
        db.runAsync(
          `INSERT INTO category (id, name, normalized_name, position) VALUES ('c-2', 'CRÈMERIE', 'crèmerie', 1)`,
          [],
        ),
      ).rejects.toThrow('UNIQUE constraint failed: category.normalized_name');
      await expect(
        db.runAsync(
          `INSERT INTO category (id, name, normalized_name, position) VALUES ('c-3', '', '', 1)`,
          [],
        ),
      ).rejects.toThrow('CHECK constraint failed');
    });

    it('003 records version 2, in one transaction', async () => {
      await seedVersion1();
      const failingAfter: Migration = async () => {
        throw new Error('migration 3 failed');
      };

      await migrate(db);
      expect(await userVersion(db)).toBe(2);

      await expect(
        migrate(db, [...MIGRATIONS, failingAfter]),
      ).rejects.toThrow();
      expect(await userVersion(db)).toBe(2);

      // A failure inside migration 2 itself leaves version 1 as it was.
      const other = new NodeSqlDatabase();
      try {
        await migrate(other, MIGRATIONS.slice(0, 1));
        await other.execAsync(
          `INSERT INTO category (id, name, normalized_name, position) VALUES ('c-1', 'A', 'a', 0)`,
        );
        const [, migration2] = MIGRATIONS;
        const brokenMigration2: Migration = async (database) => {
          await migration2?.(database);
          throw new Error('after migration 2');
        };
        await expect(
          migrate(other, [MIGRATIONS[0] as Migration, brokenMigration2]),
        ).rejects.toThrow();
        expect(
          (
            await other.getFirstAsync<{ user_version: number }>(
              'PRAGMA user_version',
              [],
            )
          )?.user_version,
        ).toBe(1);
        expect((await schema(other)).map((row) => row.name)).not.toContain(
          'pending_change',
        );
      } finally {
        other.close();
      }
    });
  });

  describe('constraints', () => {
    beforeEach(fillMigrated);

    const insertCategory = (
      id: string,
      name: string,
      normalized: string,
      position: number,
    ) =>
      db.runAsync(
        'INSERT INTO category (id, name, normalized_name, position) VALUES (?, ?, ?, ?)',
        [id, name, normalized, position],
      );

    const saveQuantity = (amount: number | null, unit: string | null) =>
      db.runAsync(
        'UPDATE list_item SET quantity_amount = ?, quantity_unit = ? WHERE list_id = ? AND article_id = ?',
        [amount, unit, 'l-1', 'a-1'],
      );

    it('reject a name of 61 characters and accept one of 60', async () => {
      await expect(
        insertCategory('c-2', 'x'.repeat(61), 'x'.repeat(61), 1),
      ).rejects.toThrow('CHECK constraint failed');
      await expect(
        insertCategory('c-2', 'é'.repeat(60), 'é'.repeat(60), 1),
      ).resolves.toBeDefined();
    });

    it('reject a duplicate normalized name', async () => {
      await expect(
        insertCategory('c-2', 'CRÈMERIE', 'crèmerie', 1),
      ).rejects.toThrow('UNIQUE constraint failed: category.normalized_name');
    });

    it('reject an amount of 0 or less, or above 9999, and accept 9999', async () => {
      await expect(saveQuantity(0, null)).rejects.toThrow(
        'CHECK constraint failed',
      );
      await expect(saveQuantity(-1, null)).rejects.toThrow(
        'CHECK constraint failed',
      );
      await expect(saveQuantity(9999.001, null)).rejects.toThrow(
        'CHECK constraint failed',
      );
      await expect(saveQuantity(9999, null)).resolves.toBeDefined();
    });

    it('reject a unit without an amount', async () => {
      await expect(saveQuantity(null, 'kg')).rejects.toThrow(
        'CHECK constraint failed',
      );
    });

    it('reject a second app_state row', async () => {
      await expect(
        db.runAsync(
          'INSERT INTO app_state (id, current_list_id) VALUES (2, ?)',
          ['l-1'],
        ),
      ).rejects.toThrow('CHECK constraint failed');
      await expect(
        db.runAsync(
          'INSERT INTO app_state (id, current_list_id) VALUES (1, ?)',
          ['l-1'],
        ),
      ).rejects.toThrow('UNIQUE constraint failed');
    });
  });
});
