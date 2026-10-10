import type { Hlc } from '@mes-courses/sync-core';

import {
  createdAtJoin,
  mergeItems,
  mergeOrder,
  tombstoneMerged,
} from './merge-by-name';
import type { ListItemRecord, ListRecord } from './records';

const hlc = (wallMs: number, deviceId = 'd-1', counter = 0): Hlc => ({
  wallMs,
  counter,
  deviceId,
});

const list = (id: string, createdAt: Hlc): ListRecord => ({
  id,
  name: 'Ma liste',
  nameHlc: createdAt,
  normalizedName: 'ma liste',
  createdHlc: createdAt,
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
});

const item = (overrides: Partial<ListItemRecord> = {}): ListItemRecord => ({
  listId: 'l-1',
  articleId: 'a-1',
  present: true,
  presentHlc: hlc(10),
  inCart: false,
  inCartHlc: hlc(10),
  quantity: null,
  quantityHlc: hlc(10),
  seq: 1,
  ...overrides,
});

describe('mergeOrder (research R8)', () => {
  it('keeps the entity created first', () => {
    const early = list('l-9', hlc(10));
    const late = list('l-1', hlc(20));

    expect(mergeOrder(late, early)).toEqual({ survivor: early, loser: late });
    expect(mergeOrder(early, late)).toEqual({ survivor: early, loser: late });
  });

  it('breaks a tie on the creation stamp with the smaller id', () => {
    const a = list('l-1', hlc(10));
    const b = list('l-2', hlc(10));

    expect(mergeOrder(b, a).survivor).toBe(a);
    expect(mergeOrder(a, b).survivor).toBe(a);
  });

  it('orders the creation stamps by counter then device id', () => {
    const a = list('l-1', hlc(10, 'd-2', 0));
    const b = list('l-2', hlc(10, 'd-1', 1));

    expect(mergeOrder(b, a).survivor).toBe(a);
  });
});

describe('tombstoneMerged', () => {
  it('marks the loser deleted and merged into the survivor, on the seq of the change', () => {
    const loser = list('l-2', hlc(20));

    expect(tombstoneMerged(loser, 'l-1', hlc(30), 7)).toEqual({
      ...loser,
      deletedHlc: hlc(30),
      mergedInto: 'l-1',
      seq: 7,
    });
  });
});

describe('createdAtJoin (research R13)', () => {
  it('keeps the stamp of a change made on a device', () => {
    expect(createdAtJoin(hlc(5_000), 9_000)).toEqual(hlc(5_000));
  });

  it('dates an entity of a snapshot, stamped with the minimum, from when the server learned it', () => {
    expect(createdAtJoin(hlc(0, 'd-7'), 9_000)).toEqual(hlc(9_000, 'd-7'));
  });
});

describe('mergeItems', () => {
  const to = { listId: 'l-1', articleId: 'a-1' };

  it('moves an item to a survivor the list does not hold yet', () => {
    const loser = item({
      listId: 'l-2',
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    });

    const { survivor, loser: tombstone } = mergeItems(
      loser,
      null,
      to,
      hlc(30),
      7,
    );

    expect(survivor).toEqual({ ...loser, ...to, seq: 7 });
    expect(tombstone).toEqual({
      ...loser,
      present: false,
      presentHlc: hlc(30),
      seq: 7,
    });
  });

  it('merges field by field when the survivor is already on the list', () => {
    const existing = item({
      inCart: true,
      inCartHlc: hlc(50),
      quantity: { amount: 1, unit: null },
      quantityHlc: hlc(5),
    });
    const loser = item({
      listId: 'l-2',
      inCart: false,
      inCartHlc: hlc(40),
      quantity: { amount: 3, unit: 'kg' },
      quantityHlc: hlc(60),
    });

    const { survivor } = mergeItems(loser, existing, to, hlc(70), 8);

    expect(survivor).toEqual({
      ...existing,
      inCart: true,
      inCartHlc: hlc(50),
      quantity: { amount: 3, unit: 'kg' },
      quantityHlc: hlc(60),
      seq: 8,
    });
  });

  it('leaves the survivor alone when the loser item is gone and the survivor is not on the list', () => {
    const loser = item({ present: false });

    expect(mergeItems(loser, null, to, hlc(30), 7)).toEqual({
      survivor: null,
      loser: null,
    });
  });

  it('does not touch a loser item that is already gone', () => {
    const loser = item({ present: false });
    const existing = item();

    expect(mergeItems(loser, existing, to, hlc(30), 7).loser).toBeNull();
  });

  it('keeps the later stamp on the marker of the loser item', () => {
    const loser = item({ presentHlc: hlc(90) });

    expect(mergeItems(loser, null, to, hlc(30), 7).loser?.presentHlc).toEqual(
      hlc(90),
    );
  });
});
