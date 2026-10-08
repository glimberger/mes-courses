import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import { newItem } from '../../domain/list-item';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import type { Quantity } from '../../domain/quantity';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';
import { uniqueName } from './unique-name';

/**
 * Creates the article, its name cleaned (FR-022), and puts it on the list in one transaction
 * (US2-7, FR-018). A name already in the catalog creates nothing and returns that article
 * (US2-9, FR-021).
 */
export const createCreateArticleAndAddToList =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (
    listId: ListId,
    { name, categoryId }: { name: string; categoryId: CategoryId },
    quantity: Quantity | null,
  ): Promise<
    Result<
      { articleId: ArticleId },
      NameError | NameAlreadyUsed<Article> | CategoryNotFound
    >
  > =>
    unitOfWork.run(async (repos) => {
      const unique = await uniqueName(repos.articles, name);
      if (!unique.ok) return unique;
      if (!(await repos.categories.findById(categoryId))) {
        return err({ type: 'CategoryNotFound' });
      }

      const articleId = ids.next() as ArticleId;
      await repos.articles.add({
        id: articleId,
        name: unique.value,
        categoryId,
      });
      // A new article is on no list yet.
      await repos.items.save(newItem({ listId, articleId }, quantity));
      return ok({ articleId });
    });
