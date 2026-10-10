import {
  encodeHlc,
  normalizedName,
  type ServerRow,
} from '@mes-courses/sync-core';

import type {
  PulledRowsApplier,
  RemoteEffects,
} from '../../application/ports/pulled-rows';
import { findAll, findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

type Row<K extends ServerRow['kind']> = Extract<ServerRow, { kind: K }>;

const KIND_ORDER: Record<ServerRow['kind'], number> = {
  category: 0,
  list: 1,
  article: 2,
  listItem: 3,
};

const exists = async (
  db: SqlDatabase,
  source: string,
  params: string[],
): Promise<boolean> =>
  (await findFirst(db, source, params, () => true)) === true;

/**
 * Pending field keys are `<kind>:<id>:<field>`, e.g. `article:a-1:name`. Rows are applied by kind
 * (categories, lists, articles, items) so that a reference never points at a row not yet written.
 */
export const sqlitePulledRowsApplier = (
  db: SqlDatabase,
): PulledRowsApplier => ({
  apply: async (rows, pendingFields) => {
    const effects: RemoteEffects = {
      deletedArticles: [],
      removedItems: [],
      merges: [],
    };
    let deferred = 0;

    const pending = (kind: string, id: string, field: string) =>
      pendingFields.has(`${kind}:${id}:${field}`);

    // Where a merged-away id ended up, following the chain inside this batch.
    const survivors = new Map<string, string>();
    for (const row of rows) {
      if (row.mergedInto !== null) survivors.set(row.id, row.mergedInto);
    }
    const finalSurvivor = (id: string): string => {
      let current = id;
      for (let hops = 0; survivors.has(current) && hops < 100; hops += 1) {
        current = survivors.get(current) as string;
      }
      return current;
    };

    // A local row this batch merges away may hold the name of its survivor: it gives the name up
    // first, and its own tombstone removes it later in the batch.
    const nameTaken = async (table: string, id: string, name: string) => {
      const owners = await findAll(
        db,
        `SELECT id FROM ${table} WHERE normalized_name = ? AND id <> ?`,
        [normalizedName(name), id],
        (row: { id: string }) => row.id,
      );
      const blocking = owners.filter((owner) => !survivors.has(owner));
      for (const owner of owners.filter((o) => survivors.has(o))) {
        await write(
          db,
          `UPDATE ${table} SET normalized_name = ? WHERE id = ?`,
          [`merged:${owner}`, owner],
        );
      }
      return blocking.length > 0;
    };

    const applyNamed = async (
      table: 'category' | 'article' | 'shopping_list',
      kind: 'category' | 'article' | 'list',
      row: Row<'category'> | Row<'article'> | Row<'list'>,
      extra: { column: string; field: string; value: string | number | null }[],
    ): Promise<void> => {
      const name = (row.fields as { name?: { value: string } }).name?.value;
      const present = await exists(db, `SELECT 1 FROM ${table} WHERE id = ?`, [
        row.id,
      ]);
      if (!present) {
        if (name === undefined || extra.some((e) => e.value === null)) return;
        if (await nameTaken(table, row.id, name)) {
          deferred += 1;
          return;
        }
        const columns = [
          'id',
          'name',
          'normalized_name',
          ...extra.map((e) => e.column),
          'created_hlc',
        ];
        await write(
          db,
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          [
            row.id,
            name,
            normalizedName(name),
            ...extra.map((e) => e.value),
            encodeHlc(row.createdHlc),
          ],
        );
        return;
      }
      const sets: string[] = [];
      const params: (string | number | null)[] = [];
      if (name !== undefined && !pending(kind, row.id, 'name')) {
        if (await nameTaken(table, row.id, name)) {
          deferred += 1;
        } else {
          sets.push('name = ?', 'normalized_name = ?');
          params.push(name, normalizedName(name));
        }
      }
      for (const e of extra) {
        if (e.value !== null && !pending(kind, row.id, e.field)) {
          sets.push(`${e.column} = ?`);
          params.push(e.value);
        }
      }
      if (sets.length === 0) return;
      await write(db, `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [
        ...params,
        row.id,
      ]);
    };

    const ordered = [...rows].sort(
      (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
    );

    for (const row of ordered) {
      if (row.kind === 'category') {
        if (row.deletedHlc !== null) {
          if (
            row.mergedInto !== null &&
            (await exists(db, 'SELECT 1 FROM category WHERE id = ?', [row.id]))
          ) {
            const survivor = finalSurvivor(row.id);
            if (
              await exists(db, 'SELECT 1 FROM category WHERE id = ?', [
                survivor,
              ])
            ) {
              await write(
                db,
                'UPDATE article SET category_id = ? WHERE category_id = ?',
                [survivor, row.id],
              );
              await write(db, 'DELETE FROM category WHERE id = ?', [row.id]);
              effects.merges.push({
                kind: 'category',
                loserId: row.id,
                survivorId: survivor,
              });
            }
          }
          continue;
        }
        await applyNamed('category', 'category', row, [
          {
            column: 'position',
            field: 'position',
            value: row.fields.position?.value ?? null,
          },
        ]);
      } else if (row.kind === 'list') {
        if (row.deletedHlc !== null) {
          if (
            row.mergedInto !== null &&
            (await exists(db, 'SELECT 1 FROM shopping_list WHERE id = ?', [
              row.id,
            ]))
          ) {
            const survivor = finalSurvivor(row.id);
            if (
              await exists(db, 'SELECT 1 FROM shopping_list WHERE id = ?', [
                survivor,
              ])
            ) {
              await write(
                db,
                'UPDATE app_state SET current_list_id = ? WHERE current_list_id = ?',
                [survivor, row.id],
              );
              await write(
                db,
                'UPDATE OR IGNORE list_item SET list_id = ? WHERE list_id = ?',
                [survivor, row.id],
              );
              await write(db, 'DELETE FROM list_item WHERE list_id = ?', [
                row.id,
              ]);
              await write(db, 'DELETE FROM shopping_list WHERE id = ?', [
                row.id,
              ]);
              effects.merges.push({
                kind: 'list',
                loserId: row.id,
                survivorId: survivor,
              });
            }
          }
          continue;
        }
        await applyNamed('shopping_list', 'list', row, []);
      } else if (row.kind === 'article') {
        if (row.deletedHlc !== null) {
          if (
            !(await exists(db, 'SELECT 1 FROM article WHERE id = ?', [row.id]))
          ) {
            continue;
          }
          const survivor =
            row.mergedInto === null ? null : finalSurvivor(row.id);
          if (
            survivor !== null &&
            (await exists(db, 'SELECT 1 FROM article WHERE id = ?', [survivor]))
          ) {
            await write(
              db,
              'UPDATE OR IGNORE list_item SET article_id = ? WHERE article_id = ?',
              [survivor, row.id],
            );
          }
          await write(db, 'DELETE FROM list_item WHERE article_id = ?', [
            row.id,
          ]);
          await write(db, 'DELETE FROM article WHERE id = ?', [row.id]);
          if (row.mergedInto === null) {
            effects.deletedArticles.push(row.id);
          } else {
            effects.merges.push({
              kind: 'article',
              loserId: row.id,
              survivorId: survivor ?? row.mergedInto,
            });
          }
          continue;
        }
        const categoryId = row.fields.categoryId?.value ?? null;
        if (
          categoryId !== null &&
          !(await exists(db, 'SELECT 1 FROM category WHERE id = ?', [
            categoryId,
          ]))
        ) {
          deferred += 1;
          continue;
        }
        await applyNamed('article', 'article', row, [
          { column: 'category_id', field: 'categoryId', value: categoryId },
        ]);
      } else {
        const listId = row.fields.listId?.value;
        const articleId = row.fields.articleId?.value;
        if (listId === undefined || articleId === undefined) continue;
        const key = `${listId}:${articleId}`;
        const present = await exists(
          db,
          'SELECT 1 FROM list_item WHERE list_id = ? AND article_id = ?',
          [listId, articleId],
        );
        if (row.fields.present?.value === false) {
          if (present && !pending('listItem', key, 'present')) {
            await write(
              db,
              'DELETE FROM list_item WHERE list_id = ? AND article_id = ?',
              [listId, articleId],
            );
            effects.removedItems.push({ listId, articleId });
          }
          continue;
        }
        const inCart = row.fields.inCart?.value;
        const quantity = row.fields.quantity;
        if (!present) {
          const parents =
            (await exists(db, 'SELECT 1 FROM shopping_list WHERE id = ?', [
              listId,
            ])) &&
            (await exists(db, 'SELECT 1 FROM article WHERE id = ?', [
              articleId,
            ]));
          if (!parents) continue;
          await write(
            db,
            'INSERT INTO list_item (list_id, article_id, in_cart, quantity_amount, quantity_unit) VALUES (?, ?, ?, ?, ?)',
            [
              listId,
              articleId,
              inCart ? 1 : 0,
              quantity?.value?.amount ?? null,
              quantity?.value?.unit ?? null,
            ],
          );
          continue;
        }
        const sets: string[] = [];
        const params: (string | number | null)[] = [];
        if (inCart !== undefined && !pending('listItem', key, 'inCart')) {
          sets.push('in_cart = ?');
          params.push(inCart ? 1 : 0);
        }
        if (quantity !== undefined && !pending('listItem', key, 'quantity')) {
          sets.push('quantity_amount = ?', 'quantity_unit = ?');
          params.push(
            quantity.value?.amount ?? null,
            quantity.value?.unit ?? null,
          );
        }
        if (sets.length > 0) {
          await write(
            db,
            `UPDATE list_item SET ${sets.join(', ')} WHERE list_id = ? AND article_id = ?`,
            [...params, listId, articleId],
          );
        }
      }
    }

    return { deferred, effects };
  },
});
