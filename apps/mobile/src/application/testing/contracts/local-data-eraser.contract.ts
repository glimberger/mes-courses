import type { LocalDataEraser } from '../../ports/local-data-eraser';
import type { UnitOfWork } from '../../ports/unit-of-work';
import type { Seed } from '../../use-cases/initialize-store';
import { article, category, item, list, listId } from './entities';

export type EraserHarness = { eraser: LocalDataEraser; unitOfWork: UnitOfWork };

export const SEED: Seed = {
  categoryNames: ['Fruits', 'Divers'],
  firstListName: 'Ma liste',
};

/** `create` builds a fresh eraser over a fresh store, for the given seed. */
export const localDataEraserContract = (
  create: (seed: Seed) => Promise<EraserHarness>,
) => {
  describe('LocalDataEraser contract', () => {
    const fill = (unitOfWork: UnitOfWork) =>
      unitOfWork.run(async (repos) => {
        await repos.categories.add(category('c-x', 'Autre', 0));
        await repos.articles.add(article('a-x', 'Lait', 'c-x'));
        await repos.lists.add(list('l-x', "Liste d'un autre compte"));
        await repos.items.save(item('l-x', 'a-x', { inCart: true }));
        await repos.appState.setCurrentListId(listId('l-x'));
        await repos.changes.record('list', 'l-x', { name: 'Autre' });
        await repos.syncState.save({
          ...(await repos.syncState.get()),
          serverUrl: 'https://courses.example.org',
          serverId: 'server-1',
          deviceId: 'device-1',
          accountId: 'account-1',
          lastSeq: 42,
          snapshotDone: true,
        });
      });

    it('004 R11 deletes the data and the outbox, and the device is back to a first launch', async () => {
      const { eraser, unitOfWork } = await create(SEED);
      await fill(unitOfWork);

      await eraser.erase();

      await unitOfWork.run(async (repos) => {
        expect(await repos.articles.all()).toEqual([]);
        expect(await repos.categories.findById('c-x' as never)).toBeNull();
        expect(await repos.lists.findById(listId('l-x'))).toBeNull();
        expect(await repos.items.forList(listId('l-x'))).toEqual([]);
        const pending = await repos.changes.pending(100);
        expect(pending.map((entry) => entry.id)).not.toContain('l-x');
      });
    });

    it('004 R11 creates the seed again: the default categories and list, current, in the outbox', async () => {
      const { eraser, unitOfWork } = await create(SEED);
      await fill(unitOfWork);

      await eraser.erase();

      await unitOfWork.run(async (repos) => {
        expect((await repos.categories.all()).map((c) => c.name)).toEqual([
          'Fruits',
          'Divers',
        ]);
        const lists = await repos.lists.all();
        expect(lists.map((l) => l.name)).toEqual(['Ma liste']);
        expect(await repos.appState.currentListId()).toBe(lists[0]?.id);
        const pending = await repos.changes.pending(100);
        expect(pending.map((entry) => entry.kind).sort()).toEqual([
          'category',
          'category',
          'list',
        ]);
      });
    });

    it('004 R11 clears the sync state: accountId and serverUrl are null', async () => {
      const { eraser, unitOfWork } = await create(SEED);
      await fill(unitOfWork);

      await eraser.erase();

      const state = await unitOfWork.run((repos) => repos.syncState.get());
      expect(state).toMatchObject({
        serverUrl: null,
        serverId: null,
        deviceId: null,
        accountId: null,
        lastSeq: 0,
        lastSyncAt: null,
        snapshotDone: false,
      });
    });

    it('004 R11 keeps the HLC high-water mark: it belongs to the device, not the account', async () => {
      const { eraser, unitOfWork } = await create(SEED);
      await fill(unitOfWork);
      const ahead = { wallMs: 9_000_000_000_000, counter: 3, deviceId: 'd-1' };
      await unitOfWork.run(async (repos) =>
        repos.syncState.save({
          ...(await repos.syncState.get()),
          maxHlc: ahead,
        }),
      );

      await eraser.erase();

      const state = await unitOfWork.run((repos) => repos.syncState.get());
      expect(state.maxHlc).toEqual(ahead);
    });

    it('004 R11 works on a store that is already a first launch, and twice in a row', async () => {
      const { eraser, unitOfWork } = await create(SEED);

      await eraser.erase();
      await eraser.erase();

      await unitOfWork.run(async (repos) => {
        expect(await repos.lists.all()).toHaveLength(1);
        expect(await repos.categories.all()).toHaveLength(2);
        expect(await repos.changes.count()).toBe(3);
      });
    });

    it('004 R11 rolls everything back when it fails in the middle', async () => {
      // Two categories with the same name break the seed after the erase has begun.
      const broken: Seed = {
        categoryNames: ['Fruits', 'fruits'],
        firstListName: 'X',
      };
      const { eraser, unitOfWork } = await create(broken);
      await fill(unitOfWork);
      const before = await unitOfWork.run(async (repos) => ({
        lists: await repos.lists.all(),
        categories: await repos.categories.all(),
        state: await repos.syncState.get(),
        pending: await repos.changes.count(),
      }));

      await expect(eraser.erase()).rejects.toThrow();

      const after = await unitOfWork.run(async (repos) => ({
        lists: await repos.lists.all(),
        categories: await repos.categories.all(),
        state: await repos.syncState.get(),
        pending: await repos.changes.count(),
      }));
      expect(after).toEqual(before);
      expect(after.state.accountId).toBe('account-1');
    });
  });
};
