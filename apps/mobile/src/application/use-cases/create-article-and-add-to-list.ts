import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import { newItem } from '../../domain/list-item';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import type { Quantity } from '../../domain/quantity';
import { ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';
import { addNewArticle } from './add-new-article';

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
      const created = await addNewArticle(repos, ids, { name, categoryId });
      if (!created.ok) return created;
      const { articleId } = created.value;
      // A new article is on no list yet.
      const item = newItem({ listId, articleId }, quantity);
      await repos.items.save(item);
      await repos.changes.record('listItem', `${listId}:${articleId}`, {
        listId,
        articleId,
        present: true,
        inCart: false,
        quantity: item.quantity,
      });
      return ok({ articleId });
    });
