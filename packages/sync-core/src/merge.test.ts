import type { Hlc } from './hlc';
import {
  compareCategories,
  mergeField,
  pickSurvivor,
  type FieldValue,
} from './merge';

const hlc = (wallMs: number, counter: number, deviceId: string): Hlc => ({
  wallMs,
  counter,
  deviceId,
});
const field = <T>(value: T, stamp: Hlc): FieldValue<T> => ({
  value,
  hlc: stamp,
});

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, i) =>
        permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(
          (rest) => [item, ...rest],
        ),
      );

describe('mergeField', () => {
  it('FR-010 keeps the incoming value when its stamp is greater', () => {
    const current = field('a', hlc(1, 0, 'x'));
    const incoming = field('b', hlc(2, 0, 'x'));
    expect(mergeField(current, incoming)).toBe(incoming);
  });

  it('FR-010 keeps the current value when its stamp is greater', () => {
    const current = field('a', hlc(3, 0, 'x'));
    expect(mergeField(current, field('b', hlc(2, 9, 'x')))).toBe(current);
  });

  it('FR-010 breaks a wall-clock tie with the deviceId', () => {
    const current = field('a', hlc(2, 1, 'a'));
    const incoming = field('b', hlc(2, 1, 'b'));
    expect(mergeField(current, incoming)).toBe(incoming);
  });

  it('FR-010 keeps the current value on an identical stamp', () => {
    const current = field('a', hlc(2, 1, 'a'));
    expect(mergeField(current, field('a', hlc(2, 1, 'a')))).toBe(current);
  });

  it('SC-003 keeps the same value whatever the order when two values share a stamp', () => {
    const a = field('one', hlc(2, 1, 'a'));
    const b = field('two', hlc(2, 1, 'a'));
    expect(mergeField(a, b)).toBe(mergeField(b, a));
  });

  it('SC-003 gives the same result for every permutation of the same changes', () => {
    const changes = [
      field('one', hlc(10, 0, 'a')),
      field('two', hlc(10, 0, 'b')),
      field('three', hlc(10, 1, 'a')),
      field('four', hlc(9, 5, 'c')),
      field('five', hlc(11, 0, 'a')),
    ];
    const results = permutations(changes).map((order) =>
      order.reduce((current, incoming) => mergeField(current, incoming)),
    );
    for (const result of results) expect(result.value).toBe('five');
  });
});

describe('pickSurvivor', () => {
  it('R8 returns the entity with the smaller createdHlc', () => {
    const older = { id: 'z', createdHlc: hlc(1, 0, 'a') };
    const newer = { id: 'a', createdHlc: hlc(2, 0, 'a') };
    expect(pickSurvivor(older, newer)).toBe(older);
    expect(pickSurvivor(newer, older)).toBe(older);
  });

  it('R8 breaks a createdHlc tie with the smaller id', () => {
    const a = { id: 'a', createdHlc: hlc(1, 0, 'x') };
    const b = { id: 'b', createdHlc: hlc(1, 0, 'x') };
    expect(pickSurvivor(a, b)).toBe(a);
    expect(pickSurvivor(b, a)).toBe(a);
  });
});

describe('compareCategories', () => {
  const category = (id: string, position: number, createdHlc: Hlc) => ({
    id,
    position,
    createdHlc,
  });

  it('FR-014 orders by position first', () => {
    const low = category('z', 1, hlc(9, 0, 'a'));
    const high = category('a', 2, hlc(1, 0, 'a'));
    expect([high, low].sort(compareCategories)).toEqual([low, high]);
  });

  it('FR-014 then by createdHlc, then by id', () => {
    const early = category('b', 3, hlc(1, 0, 'a'));
    const late = category('a', 3, hlc(2, 0, 'a'));
    const sameStampA = category('a', 3, hlc(2, 0, 'a'));
    const sameStampB = category('b', 3, hlc(2, 0, 'a'));
    expect([late, early].sort(compareCategories)).toEqual([early, late]);
    expect([sameStampB, sameStampA].sort(compareCategories)).toEqual([
      sameStampA,
      sameStampB,
    ]);
  });
});
