import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';
import { uniqueName } from './unique-name';

/**
 * Creates the article in the catalog only, its name cleaned (FR-022), and puts it on no list:
 * tidying the catalog must not change the shopping list. A name already in the catalog creates
 * nothing and returns that article (FR-021).
 */
export const createCreateArticle =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (article: {
    name: string;
    categoryId: CategoryId;
  }): Promise<
    Result<
      { articleId: ArticleId },
      NameError | NameAlreadyUsed<Article> | CategoryNotFound
    >
  > =>
    unitOfWork.run(async (repos) => {
      const unique = await uniqueName(repos.articles, article.name);
      if (!unique.ok) return unique;
      if (!(await repos.categories.findById(article.categoryId))) {
        return err({ type: 'CategoryNotFound' });
      }

      const articleId = ids.next() as ArticleId;
      await repos.articles.add({
        id: articleId,
        name: unique.value,
        categoryId: article.categoryId,
      });
      await repos.changes.record('article', articleId, {
        name: unique.value,
        categoryId: article.categoryId,
      });
      return ok({ articleId });
    });
