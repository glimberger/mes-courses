import type { Article, ArticleId, ArticleNotFound } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type { UnitOfWork } from '../ports/unit-of-work';
import { uniqueName } from './unique-name';

/**
 * Renames the article and saves its category in one transaction (FR-001, FR-002). The name is
 * cleaned and unique among the other articles (FR-008, FR-008a); on any error nothing changes.
 */
export const createEditArticle =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    articleId: ArticleId,
    { name, categoryId }: { name: string; categoryId: CategoryId },
  ): Promise<
    Result<
      void,
      NameError | NameAlreadyUsed<Article> | ArticleNotFound | CategoryNotFound
    >
  > =>
    unitOfWork.run(async (repos) => {
      const article = await repos.articles.findById(articleId);
      if (!article) return err({ type: 'ArticleNotFound' });

      if (!(await repos.categories.findById(categoryId))) {
        return err({ type: 'CategoryNotFound' });
      }

      const unique = await uniqueName(
        repos.articles,
        name,
        (existing) => existing.id === articleId,
      );
      if (!unique.ok) return unique;

      await repos.articles.update({
        id: articleId,
        name: unique.value,
        categoryId,
      });
      return ok(undefined);
    });
