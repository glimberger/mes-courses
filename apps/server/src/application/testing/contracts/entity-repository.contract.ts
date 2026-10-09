import type {
  EntityRecord,
  EntityRepository,
  Repositories,
  ServerStore,
} from '../../ports/store';
import { hlc } from './entities';

/**
 * What every entity repository (categories, articles, lists) does. `make(id, name)` builds a
 * record; `select` picks the repository from the store; `prepare` saves what the record
 * references (an article's category).
 */
export const entityRepositoryContract = <T extends EntityRecord>(
  title: string,
  createStore: () => Promise<ServerStore>,
  select: (repos: Repositories) => EntityRepository<T>,
  make: (id: string, name: string, overrides?: Partial<T>) => T,
  prepare: (repos: Repositories) => Promise<void> = async () => undefined,
) => {
  describe(`${title} repository contract`, () => {
    let store: ServerStore;

    const inRun = <R>(work: (repo: EntityRepository<T>) => Promise<R>) =>
      store.run(async (repos) => {
        await prepare(repos);
        return work(select(repos));
      });

    beforeEach(async () => {
      store = await createStore();
    });

    it('finds nothing in an empty store', async () => {
      await inRun(async (repo) => {
        expect(await repo.get('x-1')).toBeNull();
        expect(await repo.findLiveByNormalizedName('lait')).toBeNull();
        expect(await repo.changedSince(0, 10)).toEqual([]);
      });
    });

    it('returns what was saved, by id', async () => {
      const record = make('x-1', 'Lait', { seq: 3 } as Partial<T>);
      await inRun((repo) => repo.save(record));

      await inRun(async (repo) => {
        expect(await repo.get('x-1')).toEqual(record);
      });
    });

    it('save replaces the row with the same id', async () => {
      await inRun((repo) => repo.save(make('x-1', 'Lait')));
      const renamed = make('x-1', 'Lait entier', {
        seq: 2,
        deletedHlc: hlc(5),
      } as Partial<T>);
      await inRun((repo) => repo.save(renamed));

      await inRun(async (repo) => {
        expect(await repo.get('x-1')).toEqual(renamed);
        expect(await repo.changedSince(0, 10)).toEqual([renamed]);
      });
    });

    it('finds a live row by normalized name, and ignores tombstones', async () => {
      await inRun(async (repo) => {
        await repo.save(
          make('x-1', 'Lait', { deletedHlc: hlc(5), seq: 1 } as Partial<T>),
        );
        expect(await repo.findLiveByNormalizedName('lait')).toBeNull();

        const live = make('x-2', 'Lait', { seq: 2 } as Partial<T>);
        await repo.save(live);
        expect(await repo.findLiveByNormalizedName('lait')).toEqual(live);
      });
    });

    it('lists the rows changed since a seq, by increasing seq, up to the limit', async () => {
      await inRun(async (repo) => {
        await repo.save(make('x-3', 'Pain', { seq: 3 } as Partial<T>));
        await repo.save(make('x-1', 'Lait', { seq: 1 } as Partial<T>));
        await repo.save(make('x-2', 'Beurre', { seq: 2 } as Partial<T>));

        expect((await repo.changedSince(0, 10)).map((r) => r.id)).toEqual([
          'x-1',
          'x-2',
          'x-3',
        ]);
        expect((await repo.changedSince(1, 10)).map((r) => r.id)).toEqual([
          'x-2',
          'x-3',
        ]);
        expect((await repo.changedSince(0, 2)).map((r) => r.id)).toEqual([
          'x-1',
          'x-2',
        ]);
        expect(await repo.changedSince(3, 10)).toEqual([]);
      });
    });
  });
};
