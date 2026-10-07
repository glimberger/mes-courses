import type { ArticleRepository } from '../../application/ports/repositories';
import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { normalizedName } from '../../domain/name';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

type ArticleRow = { id: string; name: string; category_id: string };

const COLUMNS = 'SELECT id, name, category_id FROM article';

const toArticle = (row: ArticleRow): Article => ({
  id: row.id as ArticleId,
  name: row.name,
  categoryId: row.category_id as CategoryId,
});

export const sqliteArticleRepository = (db: SqlDatabase): ArticleRepository => {
  const findOne = (where: string, value: string) =>
    withStorageErrors(async () => {
      const row = await db.getFirstAsync<ArticleRow>(
        `${COLUMNS} WHERE ${where} = ?`,
        [value],
      );
      return row && toArticle(row);
    });

  return {
    all: () =>
      withStorageErrors(async () =>
        (await db.getAllAsync<ArticleRow>(COLUMNS, [])).map(toArticle),
      ),
    findById: (id) => findOne('id', id),
    findByNormalizedName: (normalized) =>
      findOne('normalized_name', normalized),
    add: (article) =>
      withStorageErrors(async () => {
        await db.runAsync(
          'INSERT INTO article (id, name, normalized_name, category_id) VALUES (?, ?, ?, ?)',
          [
            article.id,
            article.name,
            normalizedName(article.name),
            article.categoryId,
          ],
        );
      }),
  };
};
