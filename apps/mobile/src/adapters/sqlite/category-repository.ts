import type { CategoryRepository } from '../../application/ports/repositories';
import { compareCategories, decodeHlc } from '@mes-courses/sync-core';
import type { Category, CategoryId } from '../../domain/category';
import { normalizedName } from '../../domain/name';
import { findAll, findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

type CategoryRow = {
  id: string;
  name: string;
  position: number;
  created_hlc: string;
};

const SELECT = 'SELECT id, name, position, created_hlc FROM category';

/** The order of FR-014: `(position, created_hlc, id)`. */
const byDisplayOrder = (a: CategoryRow, b: CategoryRow) =>
  compareCategories(
    { id: a.id, position: a.position, createdHlc: decodeHlc(a.created_hlc) },
    { id: b.id, position: b.position, createdHlc: decodeHlc(b.created_hlc) },
  );

const toCategory = (row: CategoryRow): Category => ({
  id: row.id as CategoryId,
  name: row.name,
  position: row.position,
});

export const sqliteCategoryRepository = (
  db: SqlDatabase,
): CategoryRepository => ({
  all: async () =>
    (await findAll(db, SELECT, [], (row: CategoryRow) => row))
      .sort(byDisplayOrder)
      .map(toCategory),
  findById: (id) => findFirst(db, `${SELECT} WHERE id = ?`, [id], toCategory),
  findByNormalizedName: (normalized) =>
    findFirst(
      db,
      `${SELECT} WHERE normalized_name = ?`,
      [normalized],
      toCategory,
    ),
  nextPosition: async () =>
    (await findFirst(
      db,
      'SELECT coalesce(max(position) + 1, 0) AS next FROM category',
      [],
      (row: { next: number }) => row.next,
    )) ?? 0,
  add: (category) =>
    write(
      db,
      'INSERT INTO category (id, name, normalized_name, position) VALUES (?, ?, ?, ?)',
      [
        category.id,
        category.name,
        normalizedName(category.name),
        category.position,
      ],
    ),
});
