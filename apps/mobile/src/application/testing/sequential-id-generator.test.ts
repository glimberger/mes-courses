import { SequentialIdGenerator } from './sequential-id-generator';

describe('SequentialIdGenerator', () => {
  it('gives "id-1", "id-2", … in order', () => {
    const ids = new SequentialIdGenerator();

    expect([ids.next(), ids.next(), ids.next()]).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ]);
  });

  it('starts again from "id-1" in each new generator', () => {
    new SequentialIdGenerator().next();

    expect(new SequentialIdGenerator().next()).toBe('id-1');
  });
});
