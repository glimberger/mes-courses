import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { SyncResult } from '../../../application/use-cases/synchronize';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import { createAppStore } from './app-store';
import { AppStoreProvider } from './app-store-provider';
import { useRemoteRemoval } from './use-remote-removal';

const lait = 'article-lait' as ArticleId;
const pommes = 'article-pommes' as ArticleId;
const maListe = 'list-ma-liste' as ListId;

const cycleWith = (effects: Partial<SyncResult['effects']>): SyncResult => ({
  outcome: { type: 'saved' },
  effects: { deletedArticles: [], removedItems: [], merges: [], ...effects },
  pulledRows: 1,
});

const setup = async () => {
  const built = await buildStoryStore({ seed: fixture });
  const synchronize = jest.fn(async (): Promise<SyncResult> => cycleWith({}));
  const store = createAppStore({
    useCases: { ...built.useCases, synchronize },
    errorReporter: new RecordingErrorReporter(),
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppStoreProvider store={store}>{children}</AppStoreProvider>
  );
  const cycle = (effects: Partial<SyncResult['effects']>) =>
    act(async () => {
      synchronize.mockResolvedValueOnce(cycleWith(effects));
      await store.getState().syncNow();
    });
  return { store, wrapper, cycle };
};

describe('useRemoteRemoval', () => {
  it('calls back when a later cycle deletes the article', async () => {
    const { wrapper, cycle } = await setup();
    const onRemoved = jest.fn();
    renderHook(() => useRemoteRemoval({ articleId: lait }, onRemoved), {
      wrapper,
    });

    await cycle({ deletedArticles: [lait] });

    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onRemoved).toHaveBeenCalledWith('articleDeleted');
  });

  it('calls back when a later cycle removes the item from the list', async () => {
    const { wrapper, cycle } = await setup();
    const onRemoved = jest.fn();
    renderHook(
      () => useRemoteRemoval({ listId: maListe, articleId: lait }, onRemoved),
      { wrapper },
    );

    await cycle({ removedItems: [{ listId: maListe, articleId: lait }] });

    expect(onRemoved).toHaveBeenCalledWith('itemRemoved');
  });

  it('ignores another article, another list and cycles with nothing removed', async () => {
    const { wrapper, cycle } = await setup();
    const onRemoved = jest.fn();
    renderHook(
      () => useRemoteRemoval({ listId: maListe, articleId: lait }, onRemoved),
      { wrapper },
    );

    await cycle({ deletedArticles: [pommes] });
    await cycle({ removedItems: [{ listId: 'list-b', articleId: lait }] });
    await cycle({});

    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('ignores the effects of cycles before it mounted', async () => {
    const { wrapper, cycle } = await setup();
    await cycle({ deletedArticles: [lait] });
    const onRemoved = jest.fn();

    renderHook(() => useRemoteRemoval({ articleId: lait }, onRemoved), {
      wrapper,
    });
    await cycle({});

    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('stops calling back once unmounted', async () => {
    const { wrapper, cycle } = await setup();
    const onRemoved = jest.fn();
    const { unmount } = renderHook(
      () => useRemoteRemoval({ articleId: lait }, onRemoved),
      { wrapper },
    );
    unmount();

    await cycle({ deletedArticles: [lait] });

    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('follows a merge: deleting the survivor closes a form on the merged-away id', async () => {
    const { wrapper, cycle } = await setup();
    const onRemoved = jest.fn();
    renderHook(() => useRemoteRemoval({ articleId: lait }, onRemoved), {
      wrapper,
    });

    await cycle({
      merges: [{ kind: 'article', loserId: lait, survivorId: pommes }],
    });
    expect(onRemoved).not.toHaveBeenCalled();
    await cycle({ deletedArticles: [pommes] });

    expect(onRemoved).toHaveBeenCalledWith('articleDeleted');
  });

  it('leaves the sync slice untouched by a cycle that changes nothing', async () => {
    const { store, cycle } = await setup();
    const before = store.getState().sync.remote;

    await cycle({});

    expect(store.getState().sync.remote).toBe(before);
  });
});
