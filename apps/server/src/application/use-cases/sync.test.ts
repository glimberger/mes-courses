import {
  MAX_CHANGES_PER_REQUEST,
  MAX_ROWS_PER_RESPONSE,
  type Change,
  type Hlc,
  type ServerRow,
} from '@mes-courses/sync-core';

import type { Clock } from '../ports/clock';
import type { ListRecord } from '../ports/store';
import { InMemoryStore } from '../testing/in-memory-store';
import { TooManyChangesError, sync } from './sync';

const NOW = Date.parse('2026-10-01T10:00:00.000Z');

class FakeClock implements Clock {
  ms = NOW;
  nowMs() {
    return this.ms;
  }
}

const hlc = (wallMs: number, deviceId = 'd-1'): Hlc => ({
  wallMs,
  counter: 0,
  deviceId,
});

const createList = (
  changeId: string,
  id: string,
  name: string,
  at = NOW - 1000,
): Change => ({
  changeId,
  hlc: hlc(at),
  kind: 'list',
  id,
  fields: { name },
});

const setup = async () => {
  const store = new InMemoryStore();
  const clock = new FakeClock();
  await store.run(({ devices }) =>
    devices.add({
      id: 'd-1',
      name: 'Téléphone',
      credentialHash: 'hash-1',
      createdAt: '2026-10-01T09:00:00.000Z',
      lastSyncAt: null,
      revokedAt: null,
    }),
  );
  const run = (
    changes: Change[] = [],
    lastSeq = 0,
    at = hlc(NOW - 500),
    deviceId = 'd-1',
  ) => sync({ store, clock }, deviceId, { lastSeq, hlc: at, changes });
  return { store, clock, run };
};

const rowOf = (rows: ServerRow[], kind: string, id: string) =>
  rows.find((row) => row.kind === kind && row.id === id);

describe('sync', () => {
  it('applies the changes in request order', async () => {
    const { run } = await setup();

    const { rows } = await run([
      createList('ch-1', 'l-1', 'Première'),
      createList('ch-2', 'l-2', 'Deuxième'),
      createList('ch-3', 'l-3', 'Troisième'),
    ]);

    const seqs = ['l-1', 'l-2', 'l-3'].map(
      (id) => rowOf(rows, 'list', id)?.seq,
    );
    expect(seqs.every((seq) => seq !== undefined)).toBe(true);
    expect(seqs).toEqual([...seqs].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(new Set(seqs).size).toBe(3);
  });

  it('acknowledges every applied changeId', async () => {
    const { run } = await setup();

    const { acknowledged } = await run([
      createList('ch-1', 'l-1', 'Première'),
      createList('ch-2', 'l-2', 'Deuxième'),
    ]);

    expect(acknowledged).toEqual(['ch-1', 'ch-2']);
  });

  it('FR-006 acknowledges a replayed changeId and does not apply it again', async () => {
    const { run, store } = await setup();
    const first = await run([createList('ch-1', 'l-1', 'Première')]);
    const seqAfterFirst = await store.run(({ meta }) => meta.currentSeq());

    const replay = await run(
      [createList('ch-1', 'l-1', 'Première')],
      first.seq,
    );

    expect(replay.acknowledged).toEqual(['ch-1']);
    expect(await store.run(({ meta }) => meta.currentSeq())).toBe(
      seqAfterFirst,
    );
    expect(replay.rows).toEqual([]);
  });

  it('acknowledges a change with no effect', async () => {
    const { run } = await setup();
    await run([createList('ch-1', 'l-1', 'Première', NOW - 1000)]);

    const { acknowledged } = await run([
      {
        changeId: 'ch-2',
        hlc: hlc(NOW - 5000),
        kind: 'list',
        id: 'l-1',
        fields: { name: 'Plus ancien' },
      },
      {
        changeId: 'ch-3',
        hlc: hlc(NOW - 500),
        kind: 'article',
        id: 'a-unknown',
        fields: { name: 'Fantôme' },
      },
    ]);

    expect(acknowledged).toEqual(['ch-2', 'ch-3']);
  });

  it('returns every row with seq > lastSeq, tombstones included, with the new seq and the server hlc', async () => {
    const { run } = await setup();
    await run([
      {
        changeId: 'ch-1',
        hlc: hlc(NOW - 3000),
        kind: 'category',
        id: 'c-1',
        fields: { name: 'Fruits', position: 0 },
      },
      {
        changeId: 'ch-2',
        hlc: hlc(NOW - 2000),
        kind: 'article',
        id: 'a-1',
        fields: { name: 'Pommes', categoryId: 'c-1' },
      },
    ]);
    const firstPull = await run([], 0);

    const second = await run(
      [
        {
          changeId: 'ch-3',
          hlc: hlc(NOW - 1000),
          kind: 'article',
          id: 'a-1',
          fields: { deleted: true },
        },
      ],
      firstPull.seq,
    );

    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]).toMatchObject({
      kind: 'article',
      id: 'a-1',
      deletedHlc: hlc(NOW - 1000),
    });
    expect(second.seq).toBeGreaterThan(firstPull.seq);
    expect(second.seq).toBe(second.rows[0]?.seq);
    expect(second.hlc).toEqual(hlc(NOW - 500));
    expect(second.more).toBeUndefined();
  });

  it('answers with the highest hlc it holds, so a device behind catches up', async () => {
    const { run } = await setup();
    await run(
      [createList('ch-1', 'l-1', 'Courses', NOW - 100)],
      0,
      hlc(NOW - 100),
    );

    const behind = await run([], 0, hlc(NOW - 5000, 'd-2'), 'd-1');

    expect(behind.hlc).toEqual(hlc(NOW - 100));
  });

  it('returns the whole state when lastSeq is 0', async () => {
    const { run } = await setup();
    await run([
      createList('ch-1', 'l-1', 'Première'),
      createList('ch-2', 'l-2', 'Deuxième'),
    ]);

    const { rows } = await run([], 0);

    expect(rows.map((row) => row.id).sort()).toEqual(['l-1', 'l-2']);
  });

  it('pages above 5,000 rows with more: true', async () => {
    const { run, store } = await setup();
    await store.run(async ({ lists, meta }) => {
      for (let i = 1; i <= MAX_ROWS_PER_RESPONSE + 1; i += 1) {
        const seq = await meta.nextSeq();
        const record: ListRecord = {
          id: `l-${i}`,
          name: `Liste ${i}`,
          nameHlc: hlc(1),
          normalizedName: `liste ${i}`,
          createdHlc: hlc(1),
          deletedHlc: null,
          mergedInto: null,
          seq,
        };
        await lists.save(record);
      }
    });

    const first = await run([], 0);
    expect(first.rows).toHaveLength(MAX_ROWS_PER_RESPONSE);
    expect(first.more).toBe(true);
    expect(first.seq).toBe(MAX_ROWS_PER_RESPONSE);

    const second = await run([], first.seq);
    expect(second.rows).toHaveLength(1);
    expect(second.more).toBeUndefined();
    expect(second.seq).toBe(MAX_ROWS_PER_RESPONSE + 1);
  });

  it('sends the surviving row again when a later push is merged into it', async () => {
    const { run } = await setup();
    await run([createList('ch-1', 'l-a', 'Courses', NOW - 2000)]);
    const first = await run([], 0);

    const second = await run(
      [createList('ch-2', 'l-b', 'courses', NOW - 1000)],
      first.seq,
    );

    expect(second.rows.map((row) => row.id).sort()).toEqual(['l-a', 'l-b']);
    expect(rowOf(second.rows, 'list', 'l-b')?.mergedInto).toBe('l-a');
  });

  it('sends a seq holding more rows than a response whole', async () => {
    const { run, store } = await setup();
    await store.run(async ({ lists, meta }) => {
      const seq = await meta.nextSeq();
      for (let i = 1; i <= MAX_ROWS_PER_RESPONSE + 100; i += 1) {
        const record: ListRecord = {
          id: `l-${i}`,
          name: `Liste ${i}`,
          nameHlc: hlc(1),
          normalizedName: `liste ${i}`,
          createdHlc: hlc(1),
          deletedHlc: null,
          mergedInto: null,
          seq,
        };
        await lists.save(record);
      }
    });

    const first = await run([], 0);

    expect(first.rows).toHaveLength(MAX_ROWS_PER_RESPONSE + 100);
    expect(first.seq).toBe(1);
    const second = await run([], first.seq);
    expect(second.rows).toHaveLength(0);
  });

  it('refuses more than 500 changes and applies nothing', async () => {
    const { run, store } = await setup();
    const changes = Array.from(
      { length: MAX_CHANGES_PER_REQUEST + 1 },
      (_, i) => createList(`ch-${i}`, `l-${i}`, `Liste ${i}`),
    );

    await expect(run(changes)).rejects.toBeInstanceOf(TooManyChangesError);

    expect(await store.run(({ meta }) => meta.currentSeq())).toBe(0);
  });

  it('accepts exactly 500 changes', async () => {
    const { run } = await setup();
    const changes = Array.from({ length: MAX_CHANGES_PER_REQUEST }, (_, i) =>
      createList(`ch-${i}`, `l-${i}`, `Liste ${i}`),
    );

    const { acknowledged } = await run(changes);

    expect(acknowledged).toHaveLength(MAX_CHANGES_PER_REQUEST);
  });

  it('sets the lastSyncAt of the device', async () => {
    const { run, store, clock } = await setup();
    clock.ms = Date.parse('2026-10-01T10:30:00.000Z');

    await run([]);

    const device = await store.run(({ devices }) => devices.get('d-1'));
    expect(device?.lastSyncAt).toBe('2026-10-01T10:30:00.000Z');
  });

  it('clamps an HLC more than 60 s ahead of the server clock', async () => {
    const { run } = await setup();
    const future = NOW + 24 * 3600 * 1000;

    const { rows, hlc: serverHlc } = await run(
      [createList('ch-1', 'l-1', 'Première', future)],
      0,
      hlc(future),
    );

    expect(rowOf(rows, 'list', 'l-1')?.createdHlc.wallMs).toBe(NOW + 60_000);
    expect(serverHlc.wallMs).toBeLessThanOrEqual(NOW + 60_000);
  });

  it('applies nothing when a change fails midway', async () => {
    const { run, store } = await setup();
    const realRun = store.run.bind(store);
    let saves = 0;
    jest.spyOn(store, 'run').mockImplementation((work) =>
      realRun((repos) =>
        work({
          ...repos,
          lists: {
            ...repos.lists,
            save: async (record) => {
              saves += 1;
              if (saves === 2) throw new Error('disk full');
              return repos.lists.save(record);
            },
          },
        }),
      ),
    );

    await expect(
      run([
        createList('ch-1', 'l-1', 'Première'),
        createList('ch-2', 'l-2', 'Deuxième'),
      ]),
    ).rejects.toThrow('disk full');

    jest.restoreAllMocks();
    expect(await store.run(({ meta }) => meta.currentSeq())).toBe(0);
    expect(await store.run(({ lists }) => lists.get('l-1'))).toBeNull();
    expect(
      await store.run(({ appliedChanges }) => appliedChanges.has('ch-1')),
    ).toBe(false);
  });

  describe('same-name merge (FR-012, research R8)', () => {
    const device2 = 'd-2';
    const createCategory = (
      changeId: string,
      id: string,
      name: string,
      at = NOW - 1000,
      deviceId = 'd-1',
    ): Change => ({
      changeId,
      hlc: hlc(at, deviceId),
      kind: 'category',
      id,
      fields: { name, position: 0 },
    });
    const createArticle = (
      changeId: string,
      id: string,
      name: string,
      categoryId: string,
      at = NOW - 1000,
      deviceId = 'd-1',
    ): Change => ({
      changeId,
      hlc: hlc(at, deviceId),
      kind: 'article',
      id,
      fields: { name, categoryId },
    });
    const putItem = (
      changeId: string,
      listId: string,
      articleId: string,
      at: number,
      fields: Partial<{
        inCart: boolean;
        quantity: { amount: number; unit: string | null } | null;
      }> = {},
      deviceId = 'd-1',
    ): Change => ({
      changeId,
      hlc: hlc(at, deviceId),
      kind: 'listItem',
      id: `${listId}:${articleId}`,
      fields: {
        listId,
        articleId,
        present: true,
        inCart: false,
        quantity: null,
        ...fields,
      },
    });
    const live = (rows: ServerRow[], kind: string) =>
      rows.filter((row) => row.kind === kind && row.deletedHlc === null);
    const state = async (run: Awaited<ReturnType<typeof setup>>['run']) =>
      (await run([], 0)).rows;

    it('keeps the entity created first, whatever the arrival order', async () => {
      const first = await setup();
      await first.run([createList('ch-1', 'l-1', 'Ma liste', NOW - 2000)]);
      await first.run(
        [createList('ch-2', 'l-2', 'ma  LISTE', NOW - 1000)],
        0,
        hlc(NOW - 500),
      );
      const second = await setup();
      await second.run([createList('ch-2', 'l-2', 'ma  LISTE', NOW - 1000)]);
      await second.run([createList('ch-1', 'l-1', 'Ma liste', NOW - 2000)]);

      for (const { run } of [first, second]) {
        const rows = await state(run);
        expect(live(rows, 'list').map((row) => row.id)).toEqual(['l-1']);
        expect(rowOf(rows, 'list', 'l-2')).toMatchObject({
          mergedInto: 'l-1',
        });
        expect(rowOf(rows, 'list', 'l-2')?.deletedHlc).not.toBeNull();
      }
    });

    it('R13 keeps what the server holds when a joining device snapshots the same names', async () => {
      const { run } = await setup();
      await run([createList('ch-1', 'l-1', 'Ma liste')]);

      const { rows } = await run(
        [
          {
            changeId: 'ch-2',
            hlc: hlc(0, device2),
            kind: 'list',
            id: 'l-snapshot',
            fields: { name: 'Ma liste' },
          },
        ],
        0,
        hlc(NOW - 500, device2),
        'd-1',
      );

      expect(live(rows, 'list').map((row) => row.id)).toEqual(['l-1']);
      expect(rowOf(rows, 'list', 'l-snapshot')).toMatchObject({
        mergedInto: 'l-1',
      });
    });

    it('moves the articles of a merged category to the survivor', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 2000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 2000),
      ]);

      const { rows } = await run([
        createCategory('ch-3', 'c-2', 'crèmerie'),
        createArticle('ch-4', 'a-2', 'Beurre', 'c-2'),
      ]);

      expect(live(rows, 'category').map((row) => row.id)).toEqual(['c-1']);
      expect(
        live(rows, 'article').map((row) => [
          row.id,
          row.fields.categoryId?.value,
        ]),
      ).toEqual([
        ['a-1', 'c-1'],
        ['a-2', 'c-1'],
      ]);
    });

    const rename = (
      changeId: string,
      kind: 'article' | 'list',
      id: string,
      name: string,
      at: number,
    ): Change =>
      ({ changeId, hlc: hlc(at), kind, id, fields: { name } }) as Change;

    it('moves the items of a merged article, and merges them when the survivor is on the list', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 4000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 4000),
        createList('ch-3', 'l-1', 'Ma liste', NOW - 4000),
        createList('ch-4', 'l-2', 'Barbecue', NOW - 4000),
        putItem('ch-5', 'l-1', 'a-1', NOW - 4000, { inCart: true }),
        createArticle('ch-6', 'a-2', 'Beurre', 'c-1', NOW - 3000),
        putItem('ch-7', 'l-1', 'a-2', NOW - 3000, {
          quantity: { amount: 2, unit: 'L' },
        }),
        putItem('ch-8', 'l-2', 'a-2', NOW - 3000),
      ]);

      const { rows } = await run([
        rename('ch-9', 'article', 'a-2', 'lait', NOW - 100),
      ]);

      expect(live(rows, 'article').map((row) => row.id)).toEqual(['a-1']);
      expect(rowOf(rows, 'article', 'a-2')).toMatchObject({
        mergedInto: 'a-1',
      });
      const items = rows.filter((row) => row.kind === 'listItem');
      const fields = (id: string) => items.find((row) => row.id === id)?.fields;
      // Merged field by field: for each one, the later stamp wins.
      expect(fields('l-1:a-1')?.inCart?.value).toBe(false);
      expect(fields('l-1:a-1')?.quantity?.value).toEqual({
        amount: 2,
        unit: 'L',
      });
      // Moved: the barbecue list holds the survivor now.
      expect(fields('l-2:a-1')?.present?.value).toBe(true);
      // The loser's items are gone.
      expect(fields('l-1:a-2')?.present?.value).toBe(false);
      expect(fields('l-2:a-2')?.present?.value).toBe(false);
    });

    it('moves the items of a merged list to the survivor', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 4000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 4000),
        createList('ch-3', 'l-1', 'Ma liste', NOW - 4000),
        createList('ch-4', 'l-2', 'Barbecue', NOW - 3000),
        putItem('ch-5', 'l-2', 'a-1', NOW - 3000, { inCart: true }),
      ]);

      const { rows } = await run([
        rename('ch-6', 'list', 'l-2', 'ma liste', NOW - 100),
      ]);

      const items = rows.filter((row) => row.kind === 'listItem');
      const fields = (id: string) => items.find((row) => row.id === id)?.fields;
      expect(fields('l-1:a-1')?.present?.value).toBe(true);
      expect(fields('l-1:a-1')?.inCart?.value).toBe(true);
      expect(fields('l-2:a-1')?.present?.value).toBe(false);
    });

    it('merges the items already on the survivor with the same rule when a list is merged', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 4000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 4000),
        createList('ch-3', 'l-1', 'Ma liste', NOW - 4000),
        createList('ch-4', 'l-2', 'Barbecue', NOW - 3000),
        putItem('ch-5', 'l-1', 'a-1', NOW - 3000, {
          quantity: { amount: 1, unit: null },
        }),
        putItem('ch-6', 'l-2', 'a-1', NOW - 2000, {
          quantity: { amount: 5, unit: null },
        }),
      ]);

      const { rows } = await run([
        rename('ch-7', 'list', 'l-2', 'Ma liste', NOW - 100),
      ]);

      const survivor = rows.find((row) => row.id === 'l-1:a-1');
      expect(survivor?.fields.quantity?.value).toEqual({
        amount: 5,
        unit: null,
      });
    });

    it('redirects a later change that targets a merged id, following chains', async () => {
      const { run } = await setup();
      await run([
        createList('ch-1', 'l-1', 'Ma liste', NOW - 3000),
        createList('ch-2', 'l-2', 'ma liste', NOW - 2000),
        createList('ch-3', 'l-3', 'MA LISTE', NOW - 1000),
      ]);

      const { rows } = await run([
        {
          changeId: 'ch-4',
          hlc: hlc(NOW - 100),
          kind: 'list',
          id: 'l-3',
          fields: { name: 'Courses' },
        },
      ]);

      expect(
        live(rows, 'list').map((row) => [row.id, row.fields.name?.value]),
      ).toEqual([['l-1', 'Courses']]);
    });

    it('redirects the ids an item and an article point at', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 3000),
        createCategory('ch-2', 'c-2', 'crèmerie', NOW - 2000),
        createArticle('ch-3', 'a-1', 'Lait', 'c-1', NOW - 3000),
        createList('ch-4', 'l-1', 'Ma liste', NOW - 3000),
        createList('ch-5', 'l-2', 'ma liste', NOW - 2000),
      ]);

      const { rows } = await run([
        createArticle('ch-6', 'a-2', 'Beurre', 'c-2', NOW - 100),
        putItem('ch-7', 'l-2', 'a-2', NOW - 100, { inCart: true }),
      ]);

      expect(rowOf(rows, 'article', 'a-2')?.fields.categoryId?.value).toBe(
        'c-1',
      );
      const item = rows.find(
        (row) => row.kind === 'listItem' && row.id === 'l-1:a-2',
      );
      expect(item?.fields.listId?.value).toBe('l-1');
      expect(item?.fields.inCart?.value).toBe(true);
      expect(rows.find((row) => row.id === 'l-2:a-2')).toBeUndefined();
    });

    it('a rename that collides with another live entity triggers the same merge', async () => {
      const { run } = await setup();
      await run([
        createList('ch-1', 'l-1', 'Ma liste', NOW - 3000),
        createList('ch-2', 'l-2', 'Barbecue', NOW - 2000),
      ]);

      const { rows } = await run([
        {
          changeId: 'ch-3',
          hlc: hlc(NOW - 100),
          kind: 'list',
          id: 'l-2',
          fields: { name: 'ma liste' },
        },
      ]);

      expect(live(rows, 'list').map((row) => row.id)).toEqual(['l-1']);
      expect(rowOf(rows, 'list', 'l-2')).toMatchObject({ mergedInto: 'l-1' });
    });

    it('when the renamed entity survives, the other one is merged into it', async () => {
      const { run } = await setup();
      await run([
        createList('ch-1', 'l-1', 'Barbecue', NOW - 3000),
        createList('ch-2', 'l-2', 'Ma liste', NOW - 2000),
      ]);

      const { rows } = await run([
        {
          changeId: 'ch-3',
          hlc: hlc(NOW - 100),
          kind: 'list',
          id: 'l-1',
          fields: { name: 'ma liste' },
        },
      ]);

      expect(
        live(rows, 'list').map((row) => [row.id, row.fields.name?.value]),
      ).toEqual([['l-1', 'ma liste']]);
      expect(rowOf(rows, 'list', 'l-2')).toMatchObject({ mergedInto: 'l-1' });
    });

    it('gives every row a merge touches the seq of the change that caused it', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 4000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 4000),
        createList('ch-3', 'l-1', 'Ma liste', NOW - 4000),
        createArticle('ch-4', 'a-2', 'Beurre', 'c-1', NOW - 3000),
        putItem('ch-5', 'l-1', 'a-2', NOW - 3000),
      ]);
      const before = (await state(run)).reduce(
        (max, row) => Math.max(max, row.seq),
        0,
      );

      const { rows } = await run(
        [rename('ch-6', 'article', 'a-2', 'lait', NOW - 100)],
        before,
      );

      expect(new Set(rows.map((row) => row.seq))).toEqual(
        new Set([before + 1]),
      );
      expect(rows.map((row) => row.id).sort()).toEqual([
        'a-1',
        'a-2',
        'l-1:a-1',
        'l-1:a-2',
      ]);
    });

    it('sends the items of the articles of a surviving category again with it', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Bio', NOW - 4000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 4000),
        createList('ch-3', 'l-1', 'Ma liste', NOW - 4000),
        putItem('ch-4', 'l-1', 'a-1', NOW - 3900),
      ]);
      const before = (await state(run)).reduce(
        (max, row) => Math.max(max, row.seq),
        0,
      );

      const { rows } = await run(
        [createCategory('ch-5', 'c-2', 'bio', NOW - 100)],
        before,
      );

      expect(rows.map((row) => row.id).sort()).toEqual([
        'a-1',
        'c-1',
        'c-2',
        'l-1:a-1',
      ]);
    });

    it('sends the items of a surviving article again with it', async () => {
      const { run } = await setup();
      await run([
        createCategory('ch-1', 'c-1', 'Crèmerie', NOW - 4000),
        createArticle('ch-2', 'a-1', 'Lait', 'c-1', NOW - 4000),
        createList('ch-3', 'l-1', 'Ma liste', NOW - 4000),
        putItem('ch-4', 'l-1', 'a-1', NOW - 3900),
      ]);
      const before = (await state(run)).reduce(
        (max, row) => Math.max(max, row.seq),
        0,
      );

      const { rows } = await run(
        [createArticle('ch-5', 'a-2', 'lait', 'c-1', NOW - 100)],
        before,
      );

      expect(rows.map((row) => row.id).sort()).toEqual([
        'a-1',
        'a-2',
        'l-1:a-1',
      ]);
    });
  });
});
