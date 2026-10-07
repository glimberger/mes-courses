import type { ArticleRepository } from '../../application/ports/repositories';
import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { normalizedName } from '../../domain/name';
import { findAll, findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

type ArticleRow = { id: string; name: string; category_id: string };

const SELECT = 'SELECT id, name, category_id FROM article';

const toArticle = (row: ArticleRow): Article => ({
  id: row.id as ArticleId,
  name: row.name,
  categoryId: row.category_id as CategoryId,
});

export const sqliteArticleRepository = (
  db: SqlDatabase,
): ArticleRepository => ({
  // The rowid grows with each insert: the order they were added.
  all: () => findAll(db, `${SELECT} ORDER BY rowid`, [], toArticle),
  findById: (id) => findFirst(db, `${SELECT} WHERE id = ?`, [id], toArticle),
  findByNormalizedName: (normalized) =>
    findFirst(
      db,
      `${SELECT} WHERE normalized_name = ?`,
      [normalized],
      toArticle,
    ),
  add: (article) =>
    write(
      db,
      'INSERT INTO article (id, name, normalized_name, category_id) VALUES (?, ?, ?, ?)',
      [
        article.id,
        article.name,
        normalizedName(article.name),
        article.categoryId,
      ],
    ),
});
