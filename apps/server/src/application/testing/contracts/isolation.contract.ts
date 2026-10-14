import type { Repositories, ServerStore } from '../../ports/store';
import {
  account,
  appliedChange,
  article,
  category,
  device,
  hlc,
  item,
  list,
} from './entities';

/**
 * Two accounts write the same ids and the same names; neither sees, changes, counts or deletes the
 * other's rows (research R1, FR-009, SC-003). Run against the fakes and SQLite alike.
 */
export const isolationContract = (createStore: () => Promise<ServerStore>) => {
  describe('Account isolation contract', () => {
    let store: ServerStore;

    const inA = <T>(work: (repos: Repositories) => Promise<T>) =>
      store.runForAccount('acc-a', work);
    const inB = <T>(work: (repos: Repositories) => Promise<T>) =>
      store.runForAccount('acc-b', work);

    /** The same ids in both accounts, with a mark telling whose row it is. */
    const fill = (mark: string, seq: number) => async (repos: Repositories) => {
      await repos.categories.save(
        category('c-1', 'Crèmerie', { seq, position: seq }),
      );
      await repos.articles.save(
        article('a-1', 'Lait', 'c-1', { seq, nameHlc: hlc(seq) }),
      );
      await repos.lists.save(list('l-1', `Liste ${mark}`, { seq }));
      await repos.items.save(item('l-1', 'a-1', { seq, inCart: mark === 'B' }));
      await repos.appliedChanges.add(
        appliedChange('ch-1', { deviceId: `d-${mark}` }),
      );
    };

    beforeEach(async () => {
      store = await createStore();
      await store.run(async ({ accounts, devices }) => {
        await accounts.add(account('acc-a', 'a@example.org'));
        await accounts.add(account('acc-b', 'b@example.org'));
        await devices.add(device('d-A', 'h-A', { accountId: 'acc-a' }));
        await devices.add(device('d-B', 'h-B', { accountId: 'acc-b' }));
      });
      await inA(fill('A', 1));
      await inB(fill('B', 2));
    });

    it('lets each account write the same ids and the same live names', async () => {
      await inA(async (repos) => {
        expect((await repos.lists.get('l-1'))?.name).toBe('Liste A');
        expect((await repos.categories.get('c-1'))?.seq).toBe(1);
        expect((await repos.items.get('l-1', 'a-1'))?.inCart).toBe(false);
      });
      await inB(async (repos) => {
        expect((await repos.lists.get('l-1'))?.name).toBe('Liste B');
        expect((await repos.categories.get('c-1'))?.seq).toBe(2);
        expect((await repos.items.get('l-1', 'a-1'))?.inCart).toBe(true);
      });
    });

    it('shows each account only its own rows in every listing', async () => {
      await inA(async (repos) => {
        expect(
          (await repos.categories.changedSince(0, 10)).map((r) => r.seq),
        ).toEqual([1]);
        expect(
          (await repos.articles.changedSince(0, 10)).map((r) => r.seq),
        ).toEqual([1]);
        expect(
          (await repos.lists.changedSince(0, 10)).map((r) => r.seq),
        ).toEqual([1]);
        expect(
          (await repos.items.changedSince(0, 10)).map((r) => r.seq),
        ).toEqual([1]);
        expect((await repos.items.forArticle('a-1')).length).toBe(1);
        expect((await repos.items.forList('l-1')).length).toBe(1);
        expect((await repos.articles.inCategory('c-1')).length).toBe(1);
        expect(
          await repos.lists.findLiveByNormalizedName('liste b'),
        ).toBeNull();
      });
    });

    it('does not let one account change or delete the other account row', async () => {
      await inA(async (repos) => {
        await repos.lists.save(
          list('l-1', 'Renommée A', { seq: 3, deletedHlc: hlc(9) }),
        );
        await repos.items.save(item('l-1', 'a-1', { seq: 3, present: false }));
      });

      await inB(async (repos) => {
        expect((await repos.lists.get('l-1'))?.name).toBe('Liste B');
        expect((await repos.lists.get('l-1'))?.deletedHlc).toBeNull();
        expect((await repos.items.get('l-1', 'a-1'))?.present).toBe(true);
      });
    });

    it('keeps the applied change ids per account', async () => {
      await inA(async (repos) => {
        expect(await repos.appliedChanges.has('ch-1')).toBe(true);
        expect(await repos.appliedChanges.has('ch-2')).toBe(false);
        await repos.appliedChanges.add(appliedChange('ch-2'));
      });
      await inB(async (repos) => {
        expect(await repos.appliedChanges.has('ch-2')).toBe(false);
        // The same change id as the other account's is not a replay here.
        await repos.appliedChanges.add(appliedChange('ch-2'));
      });
    });

    it('keeps one global change counter across accounts', async () => {
      const first = await inA((repos) => repos.meta.nextSeq());
      const second = await inB((repos) => repos.meta.nextSeq());
      const third = await inA((repos) => repos.meta.nextSeq());

      expect([second - first, third - second]).toEqual([1, 1]);
      expect(await inB((repos) => repos.meta.currentSeq())).toBe(third);
    });

    it('lists only the devices of the asked account', async () => {
      await store.run(async ({ devices }) => {
        expect((await devices.forAccount('acc-a')).map((d) => d.id)).toEqual([
          'd-A',
        ]);
        expect((await devices.forAccount('acc-b')).map((d) => d.id)).toEqual([
          'd-B',
        ]);
        expect(await devices.forAccount('acc-none')).toEqual([]);
      });
    });

    it('rejects a row that points at the other account row', async () => {
      await inA((repos) =>
        repos.categories.save(category('c-only-a', 'Fruits', { seq: 5 })),
      );

      await expect(
        inB((repos) =>
          repos.articles.save(article('a-x', 'Pomme', 'c-only-a', { seq: 6 })),
        ),
      ).rejects.toThrow();
    });

    it('deleting an account removes its devices, data and applied changes, and nothing of the other', async () => {
      await store.run(({ accounts }) => accounts.delete('acc-a'));

      await inA(async (repos) => {
        expect(await repos.categories.get('c-1')).toBeNull();
        expect(await repos.articles.get('a-1')).toBeNull();
        expect(await repos.lists.get('l-1')).toBeNull();
        expect(await repos.items.get('l-1', 'a-1')).toBeNull();
        expect(await repos.appliedChanges.has('ch-1')).toBe(false);
        expect(await repos.devices.get('d-A')).toBeNull();
      });
      await inB(async (repos) => {
        expect((await repos.lists.get('l-1'))?.name).toBe('Liste B');
        expect(await repos.items.get('l-1', 'a-1')).not.toBeNull();
        expect(await repos.appliedChanges.has('ch-1')).toBe(true);
        expect(await repos.devices.get('d-B')).not.toBeNull();
      });
    });
  });
};
