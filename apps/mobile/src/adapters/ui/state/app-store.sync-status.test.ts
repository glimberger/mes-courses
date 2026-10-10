import type { SyncRequest, SyncResponse } from '@mes-courses/sync-core';

import type { SyncServer } from '../../../application/ports/sync-server';
import { StorageFull } from '../../../application/ports/storage-full';
import type { ArticleId } from '../../../domain/article';
import { err, ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore } from './app-store';

const lait = 'article-lait' as ArticleId;

type Reply = Awaited<ReturnType<SyncServer['sync']>>;

/** A server that acknowledges what it receives, unless `reply` says otherwise. */
const buildStore = async () => {
  let reply: (() => Reply) | null = null;
  const sync = jest.fn(async (_conn: unknown, request: SyncRequest) =>
    reply
      ? reply()
      : ok<SyncResponse>({
          serverId: 'story-server',
          apiVersion: 1,
          minAppVersion: '1.0.0',
          acknowledged: request.changes.map(({ changeId }) => changeId),
          rows: [],
          seq: 1,
          hlc: { wallMs: 10, counter: 0, deviceId: 'server' },
        }),
  );
  const built = await buildStoryStore({
    seed: fixture,
    connected: { serverUrl: 'https://courses.example.fr', lastSyncAt: null },
    syncServer: { sync },
  });
  await built.store.getState().loadCurrentList();
  return {
    ...built,
    sync,
    replyWith: (next: (() => Reply) | null) => {
      reply = next;
    },
  };
};

const reported = (errors: { context: unknown }[]) =>
  errors.filter(
    ({ context }) => (context as { operation: string }).operation === 'sync',
  );

describe('the sync status (US3, data-model sync status)', () => {
  it('003 US3-2 a local write makes the status waiting, with the count', async () => {
    const { store } = await buildStore();
    expect(store.getState().sync.status).toBe('saved');

    await store.getState().toggleItem(lait);

    expect(store.getState().sync).toMatchObject({
      status: 'waiting',
      pendingCount: 1,
    });
  });

  it('003 US3-2 the count includes the changes of the undo offer a new write ends', async () => {
    const { store } = await buildStore();
    await store.getState().removeItem(lait);
    expect(store.getState().sync.pendingCount).toBe(0);

    await store.getState().toggleItem('article-farine' as ArticleId);

    expect(store.getState().sync).toMatchObject({
      status: 'waiting',
      pendingCount: 2,
    });
  });

  it('003 US3-1 a cycle goes through sending, then saved when the outbox is empty', async () => {
    const { store, replyWith } = await buildStore();
    await store.getState().toggleItem(lait);
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.sync.status));
    replyWith(null);

    await store.getState().syncNow();

    expect(seen).toContain('sending');
    expect(store.getState().sync).toMatchObject({
      status: 'saved',
      pendingCount: 0,
    });
  });

  it('003 US3-2 stays waiting, never reported, while the server cannot be reached', async () => {
    const { store, replyWith, errorReporter } = await buildStore();
    await store.getState().toggleItem(lait);
    replyWith(() => err({ type: 'Offline' }));

    await store.getState().syncNow();

    expect(store.getState().sync).toMatchObject({
      status: 'waiting',
      pendingCount: 1,
    });
    expect(errorReporter.reports).toHaveLength(0);
  });

  it('003 US3-2 a pull that does not fit is waiting, with the storage notice once per streak', async () => {
    const built = await buildStore();
    const useCases: UseCases = {
      ...built.useCases,
      synchronize: jest.fn(async () => {
        throw new StorageFull();
      }),
    };
    const store = createAppStore({
      useCases,
      errorReporter: built.errorReporter,
    });

    await store.getState().syncNow();
    expect(store.getState().sync.status).toBe('waiting');
    expect(store.getState().notice).toEqual({ type: 'storageFull' });
    store.getState().dismissNotice();
    await store.getState().syncNow();

    expect(store.getState().notice).toBeNull();
    expect(built.errorReporter.reports).toHaveLength(0);
  });

  it('003 US3-4 three server errors in a row make it failed, reported once', async () => {
    const { store, replyWith, errorReporter } = await buildStore();
    replyWith(() => err({ type: 'ServerError' }));

    await store.getState().syncNow();
    await store.getState().syncNow();
    expect(store.getState().sync.status).toBe('waiting');
    await store.getState().syncNow();
    expect(store.getState().sync.status).toBe('failed');
    await store.getState().syncNow();

    expect(reported(errorReporter.reports)).toHaveLength(1);
    expect(reported(errorReporter.reports)[0]?.context).toEqual({
      operation: 'sync',
    });
  });

  it('003 US3-4 an untrusted server counts the same way', async () => {
    const { store, replyWith } = await buildStore();
    replyWith(() => err({ type: 'UntrustedServer' }));

    for (let i = 0; i < 3; i += 1) await store.getState().syncNow();

    expect(store.getState().sync.status).toBe('failed');
  });

  it('a success resets the streak', async () => {
    const { store, replyWith, errorReporter } = await buildStore();
    replyWith(() => err({ type: 'ServerError' }));
    await store.getState().syncNow();
    await store.getState().syncNow();
    replyWith(null);
    await store.getState().syncNow();
    expect(store.getState().sync.status).toBe('saved');
    replyWith(() => err({ type: 'ServerError' }));

    await store.getState().syncNow();
    await store.getState().syncNow();

    expect(store.getState().sync.status).toBe('waiting');
    expect(reported(errorReporter.reports)).toHaveLength(0);
  });

  it('003 US3-5 syncNow starts a cycle at once', async () => {
    const { store, sync } = await buildStore();
    sync.mockClear();

    await store.getState().syncNow();

    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('003 US3-4 retry from failed starts a cycle and recovers', async () => {
    const { store, replyWith, sync } = await buildStore();
    replyWith(() => err({ type: 'ServerError' }));
    for (let i = 0; i < 3; i += 1) await store.getState().syncNow();
    expect(store.getState().sync.status).toBe('failed');
    replyWith(null);
    sync.mockClear();

    await store.getState().retry();

    expect(sync).toHaveBeenCalledTimes(1);
    expect(store.getState().sync.status).toBe('saved');
  });

  it('a local write while failed keeps the failure visible', async () => {
    const { store, replyWith } = await buildStore();
    replyWith(() => err({ type: 'ServerError' }));
    for (let i = 0; i < 3; i += 1) await store.getState().syncNow();

    await store.getState().toggleItem(lait);

    expect(store.getState().sync.status).toBe('failed');
  });
});
