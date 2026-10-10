/** @jest-environment node */
import type { Hlc, ServerRow } from '@mes-courses/sync-core';

import { NodeSqlDatabase } from '../../../test/sqlite/node-sql-database';
import { migrate } from './migrations';
import { sqlitePulledRowsApplier } from './pulled-rows-applier';

const hlc = (wallMs: number, deviceId = 'd-2'): Hlc => ({
  wallMs,
  counter: 0,
  deviceId,
});

const NO_PENDING = new Set<string>();

type Base = {
  seq?: number;
  deletedHlc?: Hlc | null;
  mergedInto?: string | null;
};

const categoryRow = (
  id: string,
  name: string,
  position: number,
  base: Base = {},
): ServerRow => ({
  kind: 'category',
  id,
  seq: base.seq ?? 1,
  fields: {
    name: { value: name, hlc: hlc(10) },
    position: { value: position, hlc: hlc(10) },
  },
  createdHlc: hlc(10),
  deletedHlc: base.deletedHlc ?? null,
  mergedInto: base.mergedInto ?? null,
});

const articleRow = (
  id: string,
  name: string,
  categoryId: string,
  base: Base = {},
): ServerRow => ({
  kind: 'article',
  id,
  seq: base.seq ?? 1,
  fields: {
    name: { value: name, hlc: hlc(10) },
    categoryId: { value: categoryId, hlc: hlc(10) },
  },
  createdHlc: hlc(10),
  deletedHlc: base.deletedHlc ?? null,
  mergedInto: base.mergedInto ?? null,
});

const listRow = (id: string, name: string, base: Base = {}): ServerRow => ({
  kind: 'list',
  id,
  seq: base.seq ?? 1,
  fields: { name: { value: name, hlc: hlc(10) } },
  createdHlc: hlc(10),
  deletedHlc: base.deletedHlc ?? null,
  mergedInto: base.mergedInto ?? null,
});

const itemRow = (
  listId: string,
  articleId: string,
  state: {
    present?: boolean;
    inCart?: boolean;
    quantity?: { amount: number; unit: string | null } | null;
  } = {},
): ServerRow => ({
  kind: 'listItem',
  id: `${listId}:${articleId}`,
  seq: 1,
  fields: {
    listId: { value: listId, hlc: hlc(10) },
    articleId: { value: articleId, hlc: hlc(10) },
    present: { value: state.present ?? true, hlc: hlc(10) },
    inCart: { value: state.inCart ?? false, hlc: hlc(10) },
    quantity: { value: state.quantity ?? null, hlc: hlc(10) },
  },
  createdHlc: hlc(10),
  deletedHlc: null,
  mergedInto: null,
});

describe('pulled rows applier', () => {
  const opened: NodeSqlDatabase[] = [];

  const setup = async () => {
    const db = new NodeSqlDatabase();
    opened.push(db);
    await migrate(db);
    await db.runAsync(
      `INSERT INTO category (id, name, normalized_name, position) VALUES ('c-0', 'Divers', 'divers', 0)`,
      [],
    );
    await db.runAsync(
      `INSERT INTO shopping_list (id, name, normalized_name) VALUES ('l-0', 'Ma liste', 'ma liste')`,
      [],
    );
    await db.runAsync(
      `INSERT INTO app_state (id, current_list_id) VALUES (1, 'l-0')`,
      [],
    );
    return { db, applier: sqlitePulledRowsApplier(db) };
  };

  afterEach(() => {
    for (const db of opened.splice(0)) db.close();
  });

  const all = <T>(db: NodeSqlDatabase, sql: string) =>
    db.getAllAsync<T>(sql, []);

  it('upserts pulled rows into category, article, shopping_list and list_item', async () => {
    const { db, applier } = await setup();

    const { deferred } = await applier.apply(
      [
        categoryRow('c-1', 'Fruits', 1),
        articleRow('a-1', 'Pommes', 'c-1'),
        listRow('l-1', 'Fête'),
        itemRow('l-1', 'a-1', {
          inCart: true,
          quantity: { amount: 2, unit: 'kg' },
        }),
      ],
      NO_PENDING,
    );

    expect(deferred).toBe(0);
    expect(
      await all(
        db,
        `SELECT id, name, normalized_name, position FROM category WHERE id = 'c-1'`,
      ),
    ).toEqual([
      { id: 'c-1', name: 'Fruits', normalized_name: 'fruits', position: 1 },
    ]);
    expect(
      await all(
        db,
        `SELECT id, name, normalized_name, category_id FROM article`,
      ),
    ).toEqual([
      {
        id: 'a-1',
        name: 'Pommes',
        normalized_name: 'pommes',
        category_id: 'c-1',
      },
    ]);
    expect(
      await all(db, `SELECT name FROM shopping_list WHERE id = 'l-1'`),
    ).toEqual([{ name: 'Fête' }]);
    expect(
      await all(
        db,
        `SELECT list_id, article_id, in_cart, quantity_amount, quantity_unit FROM list_item`,
      ),
    ).toEqual([
      {
        list_id: 'l-1',
        article_id: 'a-1',
        in_cart: 1,
        quantity_amount: 2,
        quantity_unit: 'kg',
      },
    ]);
  });

  it('updates a row it already holds', async () => {
    const { db, applier } = await setup();
    await applier.apply([listRow('l-1', 'Fête')], NO_PENDING);

    await applier.apply([listRow('l-1', 'Anniversaire')], NO_PENDING);

    expect(
      await all(
        db,
        `SELECT name, normalized_name FROM shopping_list WHERE id = 'l-1'`,
      ),
    ).toEqual([{ name: 'Anniversaire', normalized_name: 'anniversaire' }]);
  });

  it('stores the created_hlc of a created row', async () => {
    const { db, applier } = await setup();

    await applier.apply([listRow('l-1', 'Fête')], NO_PENDING);

    const [row] = await all<{ created_hlc: string }>(
      db,
      `SELECT created_hlc FROM shopping_list WHERE id = 'l-1'`,
    );
    expect(row?.created_hlc).toContain('d-2');
  });

  describe('list items', () => {
    const withItem = async () => {
      const ctx = await setup();
      await ctx.applier.apply(
        [
          categoryRow('c-1', 'Fruits', 1),
          articleRow('a-1', 'Pommes', 'c-1'),
          listRow('l-1', 'Fête'),
          itemRow('l-1', 'a-1'),
        ],
        NO_PENDING,
      );
      return ctx;
    };

    it('deletes the local row of a listItem with present = false', async () => {
      const { db, applier } = await withItem();

      const { effects } = await applier.apply(
        [itemRow('l-1', 'a-1', { present: false })],
        NO_PENDING,
      );

      expect(await all(db, `SELECT * FROM list_item`)).toEqual([]);
      expect(effects.removedItems).toEqual([
        { listId: 'l-1', articleId: 'a-1' },
      ]);
    });

    it('does not create a local row for a listItem with present = false', async () => {
      const { db, applier } = await setup();
      await applier.apply(
        [
          categoryRow('c-1', 'Fruits', 1),
          articleRow('a-1', 'Pommes', 'c-1'),
          listRow('l-1', 'Fête'),
        ],
        NO_PENDING,
      );

      const { effects } = await applier.apply(
        [itemRow('l-1', 'a-1', { present: false })],
        NO_PENDING,
      );

      expect(await all(db, `SELECT * FROM list_item`)).toEqual([]);
      expect(effects.removedItems).toEqual([]);
    });
  });

  describe('deleted and merged articles', () => {
    const withArticle = async () => {
      const ctx = await setup();
      await ctx.applier.apply(
        [
          categoryRow('c-1', 'Fruits', 1),
          articleRow('a-1', 'Pommes', 'c-1'),
          listRow('l-1', 'Fête'),
          itemRow('l-1', 'a-1'),
        ],
        NO_PENDING,
      );
      return ctx;
    };

    it('deletes a tombstoned article and its items', async () => {
      const { db, applier } = await withArticle();

      const { effects } = await applier.apply(
        [articleRow('a-1', 'Pommes', 'c-1', { deletedHlc: hlc(20) })],
        NO_PENDING,
      );

      expect(await all(db, `SELECT id FROM article`)).toEqual([]);
      expect(await all(db, `SELECT * FROM list_item`)).toEqual([]);
      expect(effects.deletedArticles).toEqual(['a-1']);
    });

    it('deletes a merged article and its items, and reports the merge', async () => {
      const { db, applier } = await withArticle();

      const { effects } = await applier.apply(
        [
          articleRow('a-1', 'Pommes', 'c-1', {
            deletedHlc: hlc(20),
            mergedInto: 'a-2',
          }),
        ],
        NO_PENDING,
      );

      expect(await all(db, `SELECT id FROM article`)).toEqual([]);
      expect(await all(db, `SELECT * FROM list_item`)).toEqual([]);
      expect(effects.merges).toEqual([
        { kind: 'article', loserId: 'a-1', survivorId: 'a-2' },
      ]);
    });

    it('ignores a tombstone of an article it does not hold', async () => {
      const { applier } = await setup();

      const { effects } = await applier.apply(
        [articleRow('a-9', 'Fantôme', 'c-0', { deletedHlc: hlc(20) })],
        NO_PENDING,
      );

      expect(effects.deletedArticles).toEqual([]);
    });
  });

  describe('pending local changes', () => {
    it('skips the fields with a pending local change and writes the others', async () => {
      const { db, applier } = await setup();
      await applier.apply(
        [categoryRow('c-1', 'Fruits', 1), articleRow('a-1', 'Pommes', 'c-1')],
        NO_PENDING,
      );
      await db.runAsync(
        `UPDATE article SET name = 'Pommes locales', normalized_name = 'pommes locales' WHERE id = 'a-1'`,
        [],
      );

      await applier.apply(
        [articleRow('a-1', 'Pommes bio', 'c-0')],
        // The key is `<kind>:<id>:<field>`.
        new Set(['article:a-1:name']),
      );

      expect(
        await all(db, `SELECT name, normalized_name, category_id FROM article`),
      ).toEqual([
        {
          name: 'Pommes locales',
          normalized_name: 'pommes locales',
          category_id: 'c-0',
        },
      ]);
    });

    it('skips the fields of a list item with a pending local change', async () => {
      const { db, applier } = await setup();
      await applier.apply(
        [
          categoryRow('c-1', 'Fruits', 1),
          articleRow('a-1', 'Pommes', 'c-1'),
          listRow('l-1', 'Fête'),
          itemRow('l-1', 'a-1'),
        ],
        NO_PENDING,
      );
      await db.runAsync(`UPDATE list_item SET in_cart = 1`, []);

      await applier.apply(
        [
          itemRow('l-1', 'a-1', {
            inCart: false,
            quantity: { amount: 3, unit: null },
          }),
        ],
        new Set(['listItem:l-1:a-1:inCart']),
      );

      expect(
        await all(db, `SELECT in_cart, quantity_amount FROM list_item`),
      ).toEqual([{ in_cart: 1, quantity_amount: 3 }]);
    });
  });

  describe('name conflicts with a pending local create', () => {
    it('R8 defers a row that would break UNIQUE (normalized_name), without failing', async () => {
      const { db, applier } = await setup();
      await db.runAsync(
        `INSERT INTO article (id, name, normalized_name, category_id) VALUES ('a-local', 'Pommes', 'pommes', 'c-0')`,
        [],
      );

      const { deferred } = await applier.apply(
        [
          articleRow('a-remote', 'Pommes', 'c-0'),
          articleRow('a-other', 'Poires', 'c-0'),
        ],
        new Set(['article:a-local:name']),
      );

      expect(deferred).toBe(1);
      expect(await all(db, `SELECT id FROM article ORDER BY id`)).toEqual([
        { id: 'a-local' },
        { id: 'a-other' },
      ]);
    });
  });

  describe('the current list', () => {
    it('FR-015 is left alone by every row but a merge of the current list', async () => {
      const { db, applier } = await setup();

      await applier.apply(
        [
          listRow('l-1', 'Fête'),
          listRow('l-0', 'Ma liste renommée'),
          categoryRow('c-1', 'Fruits', 1),
        ],
        NO_PENDING,
      );

      expect(await all(db, `SELECT current_list_id FROM app_state`)).toEqual([
        { current_list_id: 'l-0' },
      ]);
    });

    it('R8a US2-10 moves the current list to the survivor of a merge, in the same transaction', async () => {
      const { db, applier } = await setup();

      const { effects } = await applier.apply(
        [
          listRow('l-1', 'Ma liste'),
          listRow('l-0', 'Ma liste', {
            deletedHlc: hlc(20),
            mergedInto: 'l-1',
          }),
        ],
        NO_PENDING,
      );

      expect(await all(db, `SELECT current_list_id FROM app_state`)).toEqual([
        { current_list_id: 'l-1' },
      ]);
      expect(await all(db, `SELECT id FROM shopping_list ORDER BY id`)).toEqual(
        [{ id: 'l-1' }],
      );
      expect(effects.merges).toEqual([
        { kind: 'list', loserId: 'l-0', survivorId: 'l-1' },
      ]);
    });

    it('R8a follows the mergedInto chain to the final survivor', async () => {
      const { db, applier } = await setup();

      await applier.apply(
        [
          listRow('l-3', 'Ma liste'),
          listRow('l-2', 'Ma liste', {
            deletedHlc: hlc(20),
            mergedInto: 'l-3',
          }),
          listRow('l-0', 'Ma liste', {
            deletedHlc: hlc(20),
            mergedInto: 'l-2',
          }),
        ],
        NO_PENDING,
      );

      expect(await all(db, `SELECT current_list_id FROM app_state`)).toEqual([
        { current_list_id: 'l-3' },
      ]);
    });

    it('leaves the current list when another list is merged away', async () => {
      const { db, applier } = await setup();
      await applier.apply([listRow('l-1', 'Fête')], NO_PENDING);

      await applier.apply(
        [
          listRow('l-2', 'Fête'),
          listRow('l-1', 'Fête', { deletedHlc: hlc(20), mergedInto: 'l-2' }),
        ],
        NO_PENDING,
      );

      expect(await all(db, `SELECT current_list_id FROM app_state`)).toEqual([
        { current_list_id: 'l-0' },
      ]);
    });
  });

  describe('effects', () => {
    it('are empty when the rows changed nothing of the kind', async () => {
      const { applier } = await setup();

      const { effects } = await applier.apply(
        [categoryRow('c-1', 'Fruits', 1), listRow('l-1', 'Fête')],
        NO_PENDING,
      );

      expect(effects).toEqual({
        deletedArticles: [],
        removedItems: [],
        merges: [],
      });
    });

    it('are empty for no rows', async () => {
      const { applier } = await setup();

      expect(await applier.apply([], NO_PENDING)).toEqual({
        deferred: 0,
        effects: { deletedArticles: [], removedItems: [], merges: [] },
      });
    });
  });
});
