import type { ArticleId } from '../../domain/article';
import { toggle, type ItemNotOnList } from '../../domain/list-item';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/** Puts the item in the cart, or takes it out, and saves it (FR-004, US1-4). */
export const createToggleItemInCart =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    listId: ListId,
    articleId: ArticleId,
  ): Promise<Result<{ inCart: boolean }, ItemNotOnList>> =>
    unitOfWork.run(async (repos) => {
      const item = await repos.items.find(listId, articleId);
      if (!item) return err({ type: 'ItemNotOnList' });
      const toggled = toggle(item);
      await repos.items.save(toggled);
      return ok({ inCart: toggled.inCart });
    });
