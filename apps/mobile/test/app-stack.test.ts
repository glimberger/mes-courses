/** @jest-environment node */
import { FakeClock } from '../src/application/testing/fake-clock';
import { buildTestAppStack } from './app-stack';

describe('buildTestAppStack', () => {
  it('prepares a database of its own as on a device: WAL journal, seeded store', async () => {
    const stack = await buildTestAppStack({
      serverUrl: 'http://127.0.0.1:1',
      clock: new FakeClock(),
    });

    try {
      expect(
        await stack.database.getFirstAsync('PRAGMA journal_mode', []),
      ).toEqual({
        journal_mode: 'wal',
      });
      expect((await stack.useCases.getLists()).length).toBe(1);
    } finally {
      stack.database.close();
    }
  });

  it('gives each stack its own database', async () => {
    const clock = new FakeClock();
    const first = await buildTestAppStack({
      serverUrl: 'http://127.0.0.1:1',
      clock,
    });
    const second = await buildTestAppStack({
      serverUrl: 'http://127.0.0.1:1',
      clock,
    });

    try {
      const [list] = await first.useCases.getLists();
      await first.useCases.createList('Barbecue');
      expect((await first.useCases.getLists()).length).toBe(2);
      expect((await second.useCases.getLists()).length).toBe(1);
      expect(list?.name).toBe('Ma liste');
    } finally {
      first.database.close();
      second.database.close();
    }
  });
});
