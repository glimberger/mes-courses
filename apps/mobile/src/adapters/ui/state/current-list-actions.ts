import type { ArticleId } from '../../../domain/article';
import {
  summarizeSections,
  type CurrentListView,
} from '../../../domain/current-list-view';
import { err, ok, type Result } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import type { StoreCore, StoreKit, WriteFailed } from './store-kit';

/** The actions of the current list screen (User Story 1). */
export type CurrentListActions = {
  /** Loads the current list; also used by "Réessayer". */
  loadCurrentList: () => Promise<void>;
  /**
   * Ticks or unticks the item at once, then saves it in the write queue (research R9). Resolves
   * once the save, and the reload that follows it, are done.
   */
  toggleItem: (articleId: ArticleId) => Promise<void>;
  /** Unticks every item once the save succeeds; nothing changes before (research R9a). */
  finishShopping: () => Promise<Result<void, WriteFailed>>;
};

/** A toggle still queued when an earlier toggle of its item failed: it is not saved (R9). */
type Dropped = { type: 'Dropped' };

/** The current list's id, when the region shows a list. */
const shownListId = (region: StoreCore['currentList']): ListId | null => {
  switch (region.status) {
    case 'success':
      return region.data.list.id;
    case 'empty':
      return region.detail.list.id;
    default:
      return null;
  }
};

/** The view with the chosen items ticked or unticked, sorted and counted again. */
const flipItems = (
  view: CurrentListView,
  flipped: (articleId: ArticleId) => boolean,
): CurrentListView =>
  summarizeSections(
    view.list,
    view.sections.map((section) => ({
      category: section.category,
      items: section.items.map((item) =>
        flipped(item.articleId) ? { ...item, inCart: !item.inCart } : item,
      ),
    })),
  );

export const createCurrentListActions = ({
  get,
  set,
  useCases,
  runWrite,
  region,
}: StoreKit): CurrentListActions => {
  // Per item, the toggles tapped and not saved yet. A view read from storage is shown with the
  // items whose count is odd flipped, so a reload never undoes a tick still waiting in the queue.
  const unsaved = new Map<ArticleId, number>();
  // Per item, bumped when a save fails: the toggles tapped before it are then dropped.
  const generations = new Map<ArticleId, number>();

  const withUnsaved = (view: CurrentListView): CurrentListView =>
    flipItems(view, (articleId) => (unsaved.get(articleId) ?? 0) % 2 === 1);

  const loadCurrentList = region('currentList', 'getCurrentList', async () => {
    const view = await useCases.getCurrentList();
    return view.totalCount === 0
      ? { status: 'empty', detail: { list: view.list } }
      : { status: 'success', data: withUnsaved(view) };
  });

  const showToggled = (articleId: ArticleId) => {
    unsaved.set(articleId, (unsaved.get(articleId) ?? 0) + 1);
    const shown = get().currentList;
    if (shown.status !== 'success') return;
    set({
      currentList: {
        status: 'success',
        data: flipItems(shown.data, (id) => id === articleId),
      },
    });
  };

  /** Forgets the item's unsaved toggles and drops those still queued. */
  const dropUnsaved = (articleId: ArticleId) => {
    unsaved.delete(articleId);
    generations.set(articleId, (generations.get(articleId) ?? 0) + 1);
  };

  const toggleItem = async (articleId: ArticleId) => {
    const listId = shownListId(get().currentList);
    if (listId === null) return;
    const generation = generations.get(articleId) ?? 0;
    showToggled(articleId);

    const outcome = await runWrite<
      { inCart: boolean },
      Dropped | { type: string }
    >(
      'toggleItemInCart',
      async () => {
        if ((generations.get(articleId) ?? 0) !== generation) {
          return err({ type: 'Dropped' });
        }
        // The item's state is settled here, before the next write of the queue starts.
        try {
          const saved = await useCases.toggleItemInCart(listId, articleId);
          if (saved.ok) {
            const left = (unsaved.get(articleId) ?? 1) - 1;
            if (left > 0) unsaved.set(articleId, left);
            else unsaved.delete(articleId);
          } else {
            dropUnsaved(articleId);
          }
          return saved;
        } catch (error) {
          dropUnsaved(articleId);
          throw error;
        }
      },
      { expected: ['Dropped'] },
    );
    // A failed save: show the item as stored.
    if (!outcome.ok && outcome.error.type === 'WriteFailed') {
      await loadCurrentList();
    }
  };

  const finishShopping = async (): Promise<Result<void, WriteFailed>> => {
    const listId = shownListId(get().currentList);
    if (listId === null) return ok(undefined);
    return runWrite('finishShopping', () => useCases.finishShopping(listId));
  };

  return { loadCurrentList, toggleItem, finishShopping };
};
