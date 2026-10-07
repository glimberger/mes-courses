import type { ArticleNotFound } from '../../domain/article';
import type { AlreadyOnList, RemovedItem } from '../../domain/list-item';
import { err, ok, type Result } from '../../domain/result';
import type { ListNotFound } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/** Puts a removed item back as it was, ticked or not, with its quantity (US2-16, FR-010). */
export const createRestoreRemovedItem =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    removed: RemovedItem,
  ): Promise<Result<void, AlreadyOnList | ListNotFound | ArticleNotFound>> =>
    unitOfWork.run(async (repos) => {
      if (!(await repos.lists.findById(removed.listId))) {
        return err({ type: 'ListNotFound' });
      }
      if (!(await repos.articles.findById(removed.articleId))) {
        return err({ type: 'ArticleNotFound' });
      }
      const onList = await repos.items.find(removed.listId, removed.articleId);
      if (onList) {
        return err({ type: 'AlreadyOnList', quantity: onList.quantity });
      }
      await repos.items.save({ ...removed });
      return ok(undefined);
    });
