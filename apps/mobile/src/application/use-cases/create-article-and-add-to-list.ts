import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import { add } from '../../domain/list-item';
import {
  normalizedName,
  validateName,
  type NameAlreadyUsed,
  type NameError,
} from '../../domain/name';
import type { Quantity } from '../../domain/quantity';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';

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
      const validated = validateName(name);
      if (!validated.ok) return validated;
      const existing = await repos.articles.findByNormalizedName(
        normalizedName(validated.value),
      );
      if (existing) return err({ type: 'NameAlreadyUsed', existing });
      if (!(await repos.categories.findById(categoryId))) {
        return err({ type: 'CategoryNotFound' });
      }

      const articleId = ids.next() as ArticleId;
      await repos.articles.add({
        id: articleId,
        name: validated.value,
        categoryId,
      });
      const added = add(null, { listId, articleId }, quantity);
      if (!added.ok) throw new Error('A new article is on no list');
      await repos.items.save(added.value);
      return ok({ articleId });
    });
