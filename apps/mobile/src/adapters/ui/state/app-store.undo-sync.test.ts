import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { SyncResult } from '../../../application/use-cases/synchronize';
import type { ArticleId } from '../../../domain/article';
import { err, ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore } from './app-store';

const lait = 'article-lait' as ArticleId;
const pommes = 'article-pommes' as ArticleId;

const NO_EFFECTS = { deletedArticles: [], removedItems: [], merges: [] };

/** What 062 and 067 add to the value the use cases return: the id of the undo offer. */
const withUndoId = <T extends object>(value: T, undoId: string) =>
  Object.assign(value, { undoId });

const cycleDeleting = (...deletedArticles: ArticleId[]): SyncResult => ({
  outcome: { type: 'saved' },
  effects: { ...NO_EFFECTS, deletedArticles },
  pulledRows: deletedArticles.length,
});

/** A store on the fixture whose removals and deletions carry undo ids "undo-1", "undo-2", … */
const buildStore = async () => {
  const built = await buildStoryStore({ seed: fixture });
  let undoIds = 0;
  const releaseHeldChanges = jest.fn(async (_undoId: string) => undefined);
  const synchronize = jest.fn(async (): Promise<SyncResult> => ({
    outcome: { type: 'saved' },
    effects: NO_EFFECTS,
    pulledRows: 0,
  }));
  const restoreRemovedItem = jest.fn(built.useCases.restoreRemovedItem);
  const restoreDeletedArticle = jest.fn(built.useCases.restoreDeletedArticle);
  const useCases: UseCases = {
    ...built.useCases,
    removeItemFromList: async (listId, articleId) => {
      const outcome = await built.useCases.removeItemFromList(
        listId,
        articleId,
      );
      return outcome.ok
        ? ok(withUndoId(outcome.value, `undo-${++undoIds}`))
        : outcome;
    },
    deleteArticle: async (articleId) => {
      const outcome = await built.useCases.deleteArticle(articleId);
      return outcome.ok
        ? ok(withUndoId(outcome.value, `undo-${++undoIds}`))
        : outcome;
    },
    restoreRemovedItem,
    restoreDeletedArticle,
    releaseHeldChanges,
    synchronize,
  };
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  await store.getState().loadCurrentList();
  await store.getState().loadCatalog();
  await store.getState().loadLists();
  return {
    store,
    releaseHeldChanges,
    synchronize,
    restoreRemovedItem,
    restoreDeletedArticle,
    errorReporter,
  };
};

describe('the undo offer and synchronization', () => {
  describe('when an offer ends (FR-008, research R10)', () => {
    it('releases the held changes when the offer is dismissed (the 5 s end)', async () => {
      const { store, releaseHeldChanges } = await buildStore();
      await store.getState().removeItem(lait);

      store.getState().dismissUndo();

      expect(store.getState().pendingUndo).toBeNull();
      expect(releaseHeldChanges).toHaveBeenCalledTimes(1);
      expect(releaseHeldChanges).toHaveBeenCalledWith('undo-1');
    });

    it('releases the held changes of a deleted article when its offer is dismissed', async () => {
      const { store, releaseHeldChanges } = await buildStore();
      await store.getState().deleteArticle(lait);

      store.getState().dismissUndo();

      expect(releaseHeldChanges).toHaveBeenCalledWith('undo-1');
    });

    it('releases them when the next successful write ends the offer', async () => {
      const { store, releaseHeldChanges } = await buildStore();
      await store.getState().removeItem(lait);

      await store.getState().toggleItem(pommes);

      expect(store.getState().pendingUndo).toBeNull();
      expect(releaseHeldChanges).toHaveBeenCalledTimes(1);
      expect(releaseHeldChanges).toHaveBeenCalledWith('undo-1');
    });

    it('releases them when a new undo offer replaces the first', async () => {
      const { store, releaseHeldChanges } = await buildStore();
      await store.getState().removeItem(lait);

      await store.getState().removeItem(pommes);

      expect(releaseHeldChanges).toHaveBeenCalledTimes(1);
      expect(releaseHeldChanges).toHaveBeenCalledWith('undo-1');
      expect(store.getState().pendingUndo).toMatchObject({
        removed: { undoId: 'undo-2' },
      });
    });

    it('releases nothing while the offer stands', async () => {
      const { store, releaseHeldChanges } = await buildStore();

      await store.getState().removeItem(lait);

      expect(releaseHeldChanges).not.toHaveBeenCalled();
    });

    it('releases nothing when dismissUndo is called with no offer', async () => {
      const { store, releaseHeldChanges } = await buildStore();

      store.getState().dismissUndo();

      expect(releaseHeldChanges).not.toHaveBeenCalled();
    });

    it('does not release the held changes when "Annuler" restores them: the restore discards them', async () => {
      const { store, releaseHeldChanges, restoreRemovedItem } =
        await buildStore();
      await store.getState().removeItem(lait);

      await store.getState().undo();

      expect(restoreRemovedItem).toHaveBeenCalledTimes(1);
      expect(releaseHeldChanges).not.toHaveBeenCalled();
    });

    it('does not release the held changes when "Annuler" restores a deleted article', async () => {
      const { store, releaseHeldChanges, restoreDeletedArticle } =
        await buildStore();
      await store.getState().deleteArticle(lait);

      await store.getState().undo();

      expect(restoreDeletedArticle).toHaveBeenCalledTimes(1);
      expect(releaseHeldChanges).not.toHaveBeenCalled();
    });

    it('reports a release that fails, without a notice', async () => {
      const { store, releaseHeldChanges, errorReporter } = await buildStore();
      releaseHeldChanges.mockRejectedValueOnce(new Error('disk'));
      await store.getState().removeItem(lait);

      store.getState().dismissUndo();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(errorReporter.reports).toEqual([
        {
          error: expect.any(Error),
          context: { operation: 'releaseHeldChanges' },
        },
      ]);
      expect(store.getState().notice).toBeNull();
    });
  });

  describe('when a pull deletes the article of the offer (US1-8, research R10a)', () => {
    it.each(['category', 'list'] as const)(
      'ends the offer of a deleted article when the pull merges away its %s',
      async (kind) => {
        const { store, synchronize, releaseHeldChanges } = await buildStore();
        await store.getState().deleteArticle(lait);
        const offer = store.getState().pendingUndo;
        if (offer?.kind !== 'deletedArticle') throw new Error('no offer');
        const loserId =
          kind === 'category'
            ? offer.deleted.article.categoryId
            : (offer.deleted.items[0]?.listId as string);
        synchronize.mockResolvedValueOnce({
          outcome: { type: 'saved' },
          effects: {
            ...NO_EFFECTS,
            merges: [{ kind, loserId, survivorId: 'other' }],
          },
          pulledRows: 2,
        });

        await store.getState().syncNow();

        expect(store.getState().pendingUndo).toBeNull();
        expect(releaseHeldChanges).toHaveBeenCalledTimes(1);
      },
    );

    it('ends the offer when the article is merged into another by the pull', async () => {
      const { store, synchronize, releaseHeldChanges } = await buildStore();
      await store.getState().deleteArticle(lait);
      synchronize.mockResolvedValueOnce({
        outcome: { type: 'saved' },
        effects: {
          ...NO_EFFECTS,
          merges: [{ kind: 'article', loserId: lait, survivorId: pommes }],
        },
        pulledRows: 2,
      });

      await store.getState().syncNow();

      expect(store.getState().pendingUndo).toBeNull();
      expect(releaseHeldChanges).toHaveBeenCalledTimes(1);
    });

    it('ends the offer of a removed item of that article, releasing its held changes', async () => {
      const { store, synchronize, releaseHeldChanges } = await buildStore();
      await store.getState().removeItem(lait);
      synchronize.mockResolvedValueOnce(cycleDeleting(lait));

      await store.getState().syncNow();

      expect(store.getState().pendingUndo).toBeNull();
      expect(releaseHeldChanges).toHaveBeenCalledTimes(1);
      expect(releaseHeldChanges).toHaveBeenCalledWith('undo-1');
    });

    it('ends the offer of a deleted article that another device deleted too', async () => {
      const { store, synchronize, releaseHeldChanges } = await buildStore();
      await store.getState().deleteArticle(lait);
      synchronize.mockResolvedValueOnce(cycleDeleting(lait));

      await store.getState().syncNow();

      expect(store.getState().pendingUndo).toBeNull();
      expect(releaseHeldChanges).toHaveBeenCalledWith('undo-1');
    });

    it('keeps the offer when the pull deleted another article', async () => {
      const { store, synchronize, releaseHeldChanges } = await buildStore();
      await store.getState().removeItem(lait);
      synchronize.mockResolvedValueOnce(cycleDeleting(pommes));

      await store.getState().syncNow();

      expect(store.getState().pendingUndo).toMatchObject({
        removed: { articleId: lait, undoId: 'undo-1' },
      });
      expect(releaseHeldChanges).not.toHaveBeenCalled();
    });

    it('a later undo(undoId) restores nothing and shows the notice', async () => {
      const { store, synchronize, restoreRemovedItem } = await buildStore();
      await store.getState().removeItem(lait);
      synchronize.mockResolvedValueOnce(cycleDeleting(lait));
      await store.getState().syncNow();

      await store.getState().undo('undo-1');

      expect(restoreRemovedItem).not.toHaveBeenCalled();
      expect(store.getState().notice).toEqual({
        type: 'articleDeletedElsewhere',
      });
    });

    it('a later undo(undoId) of a deleted article restores nothing either', async () => {
      const { store, synchronize, restoreDeletedArticle } = await buildStore();
      await store.getState().deleteArticle(lait);
      synchronize.mockResolvedValueOnce(cycleDeleting(lait));
      await store.getState().syncNow();

      await store.getState().undo('undo-1');

      expect(restoreDeletedArticle).not.toHaveBeenCalled();
      expect(store.getState().notice).toEqual({
        type: 'articleDeletedElsewhere',
      });
    });

    it('an undo of another offer still restores it', async () => {
      const { store, synchronize, restoreRemovedItem } = await buildStore();
      await store.getState().removeItem(lait);
      synchronize.mockResolvedValueOnce(cycleDeleting(lait));
      await store.getState().syncNow();
      await store.getState().removeItem(pommes);

      await store.getState().undo('undo-2');

      expect(restoreRemovedItem).toHaveBeenCalledTimes(1);
      expect(store.getState().notice).toBeNull();
    });
  });

  describe('when a restore finds the article gone', () => {
    it('shows the notice, unreported, when restoreRemovedItem returns ArticleNotFound', async () => {
      const { store, restoreRemovedItem, errorReporter } = await buildStore();
      await store.getState().removeItem(lait);
      restoreRemovedItem.mockResolvedValueOnce(
        err({ type: 'ArticleNotFound' }),
      );

      await store.getState().undo();

      expect(store.getState().notice).toEqual({
        type: 'articleDeletedElsewhere',
      });
      expect(errorReporter.reports).toEqual([]);
    });
  });
});
