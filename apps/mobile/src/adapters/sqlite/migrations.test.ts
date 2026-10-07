/** @jest-environment node */
import { DataFromNewerVersion } from '../../application/ports/data-from-newer-version';
import { NodeSqlDatabase } from '../../../test/sqlite/node-sql-database';
import { MIGRATIONS, migrate, type Migration } from './migrations';

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
    await migrate(db);

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

    expect(await userVersion(db)).toBe(1);

    await migrate(db);

    expect(await userVersion(db)).toBe(1);
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

    expect(await userVersion(db)).toBe(1);
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
          position        INTEGER NOT NULL UNIQUE
        );
        INSERT INTO category_new SELECT id, name, normalized_name, position FROM category;
        DROP TABLE category;
        ALTER TABLE category_new RENAME TO category;
      `);
    };

    await migrate(db, [...MIGRATIONS, rebuildCategory]);

    expect(await userVersion(db)).toBe(2);
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

    expect(await userVersion(db)).toBe(1);
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
