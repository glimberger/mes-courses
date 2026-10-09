import { compareHlc, type Hlc } from '@mes-courses/sync-core';
import type { UnitOfWork } from '../../ports/unit-of-work';
import type { FakeClock } from '../fake-clock';

type Created = { unitOfWork: UnitOfWork; clock: FakeClock };

/** Whether each stamp is strictly greater than the one before. */
const strictlyIncreasing = (stamps: Hlc[]) =>
  stamps.every(
    (stamp, i) => i === 0 || compareHlc(stamps[i - 1] as Hlc, stamp) < 0,
  );

export const changeRecorderContract = (create: () => Promise<Created>) => {
  describe('ChangeRecorder contract', () => {
    let unitOfWork: UnitOfWork;
    let clock: FakeClock;

    beforeEach(async () => {
      ({ unitOfWork, clock } = await create());
      clock.set(1_000);
    });

    const pending = (limit = 500) =>
      unitOfWork.run((repos) => repos.changes.pending(limit));
    const count = () => unitOfWork.run((repos) => repos.changes.count());

    it('records the kind, the id and the fields, with a unique change id', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record('list', 'l-1', { name: 'Ma liste' });
        await changes.record('listItem', 'l-1:a-1', { inCart: true });
      });

      const [first, second] = await pending();
      expect(first).toMatchObject({
        kind: 'list',
        id: 'l-1',
        fields: { name: 'Ma liste' },
      });
      expect(second).toMatchObject({
        kind: 'listItem',
        id: 'l-1:a-1',
        fields: { inCart: true },
      });
      expect(first?.changeId).not.toBe(second?.changeId);
    });

    it('stamps a strictly increasing HLC from the Clock', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record('list', 'l-1', { name: 'A' });
        // Same millisecond: the counter breaks the tie.
        await changes.record('list', 'l-2', { name: 'B' });
        // The clock goes backwards: the stamp does not.
        clock.set(500);
        await changes.record('list', 'l-3', { name: 'C' });
        clock.set(5_000);
        await changes.record('list', 'l-4', { name: 'D' });
      });

      const stamps = (await pending()).map((c) => c.hlc);
      expect(strictlyIncreasing(stamps)).toBe(true);
      expect(stamps[0]?.wallMs).toBe(1_000);
      expect(stamps[3]?.wallMs).toBe(5_000);
    });

    it('keeps the stamps increasing across runs', async () => {
      await unitOfWork.run((repos) =>
        repos.changes.record('list', 'l-1', { name: 'A' }),
      );
      await unitOfWork.run((repos) =>
        repos.changes.record('list', 'l-2', { name: 'B' }),
      );

      expect(strictlyIncreasing((await pending()).map((c) => c.hlc))).toBe(
        true,
      );
    });

    it('returns the pending changes in the order they were recorded, up to the limit', async () => {
      await unitOfWork.run(async ({ changes }) => {
        for (const id of ['l-1', 'l-2', 'l-3']) {
          await changes.record('list', id, { name: id });
        }
      });

      expect((await pending(2)).map((c) => c.id)).toEqual(['l-1', 'l-2']);
      expect((await pending()).map((c) => c.id)).toEqual(['l-1', 'l-2', 'l-3']);
    });

    it('excludes held entries from pending and count, and keeps the order of the others', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record('list', 'l-1', { name: 'A' });
        await changes.record(
          'listItem',
          'l-1:a-1',
          { present: false },
          {
            heldBy: 'undo-1',
          },
        );
        await changes.record('list', 'l-2', { name: 'B' });
      });

      expect((await pending()).map((c) => c.id)).toEqual(['l-1', 'l-2']);
      expect(await count()).toBe(2);
    });

    it('release makes the entries of one undo offer pending, in their place', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record('list', 'l-1', { name: 'A' });
        await changes.record(
          'article',
          'a-1',
          { deleted: true },
          {
            heldBy: 'undo-1',
          },
        );
        await changes.record(
          'article',
          'a-2',
          { deleted: true },
          {
            heldBy: 'undo-2',
          },
        );
        await changes.record('list', 'l-2', { name: 'B' });
      });

      await unitOfWork.run((repos) => repos.changes.release('undo-1'));

      expect((await pending()).map((c) => c.id)).toEqual(['l-1', 'a-1', 'l-2']);
      expect(await count()).toBe(3);
    });

    it('releaseAll makes every held entry pending', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record(
          'article',
          'a-1',
          { deleted: true },
          {
            heldBy: 'undo-1',
          },
        );
        await changes.record(
          'article',
          'a-2',
          { deleted: true },
          {
            heldBy: 'undo-2',
          },
        );
      });

      await unitOfWork.run((repos) => repos.changes.releaseAll());

      expect((await pending()).map((c) => c.id)).toEqual(['a-1', 'a-2']);
      expect(await count()).toBe(2);
    });

    it('discard deletes the entries of one undo offer, so they are never sent', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record(
          'article',
          'a-1',
          { deleted: true },
          {
            heldBy: 'undo-1',
          },
        );
        await changes.record(
          'article',
          'a-2',
          { deleted: true },
          {
            heldBy: 'undo-2',
          },
        );
      });

      await unitOfWork.run((repos) => repos.changes.discard('undo-1'));
      await unitOfWork.run((repos) => repos.changes.releaseAll());

      expect((await pending()).map((c) => c.id)).toEqual(['a-2']);
    });

    it('acknowledge removes the given entries only', async () => {
      await unitOfWork.run(async ({ changes }) => {
        await changes.record('list', 'l-1', { name: 'A' });
        await changes.record('list', 'l-2', { name: 'B' });
        await changes.record('list', 'l-3', { name: 'C' });
      });
      const [first, , third] = (await pending()).map((c) => c.changeId);

      await unitOfWork.run((repos) =>
        repos.changes.acknowledge([
          first as string,
          third as string,
          'unknown',
        ]),
      );

      expect((await pending()).map((c) => c.id)).toEqual(['l-2']);
      expect(await count()).toBe(1);
    });

    it('counts nothing when the outbox is empty', async () => {
      expect(await count()).toBe(0);
      expect(await pending()).toEqual([]);
    });

    it('keeps no entry from a run that throws', async () => {
      await expect(
        unitOfWork.run(async ({ changes }) => {
          await changes.record('list', 'l-1', { name: 'A' });
          throw new Error('the write failed');
        }),
      ).rejects.toThrow('the write failed');

      expect(await pending()).toEqual([]);
      expect(await count()).toBe(0);
    });

    it('does not move the clock state back when a run throws', async () => {
      await unitOfWork.run((repos) =>
        repos.changes.record('list', 'l-1', { name: 'A' }),
      );
      await expect(
        unitOfWork.run(async ({ changes }) => {
          await changes.record('list', 'l-2', { name: 'B' });
          throw new Error('rolled back');
        }),
      ).rejects.toThrow();
      await unitOfWork.run((repos) =>
        repos.changes.record('list', 'l-3', { name: 'C' }),
      );

      expect(strictlyIncreasing((await pending()).map((x) => x.hlc))).toBe(
        true,
      );
    });
  });
};
