import { signInDevice } from './testing/onboard';
import { FakeClock, buildTestAppStack } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const START = Date.parse('2026-11-10T10:00:00.000Z');

describe('the sync server address fixed at build time (013 US3)', () => {
  let clock: FakeClock;
  const servers: TestServer[] = [];
  let server: TestServer;

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
    servers.push(server);
  });
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => s.close()));
  });

  const pairedDevice = async () => {
    const stack = await buildTestAppStack({ serverUrl: server.url, clock });
    const connected = await signInDevice(server, stack, 'Pixel');
    expect(connected.ok).toBe(true);
    clock.advance(1_000);
    expect((await stack.useCases.synchronize()).outcome.type).toBe('saved');
    return stack;
  };

  it('US3-1 syncs a paired device whatever address it stored', async () => {
    const stack = await pairedDevice();
    await stack.unitOfWork.run(async (repos) => {
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        serverUrl: 'https://junk.invalid',
      });
    });
    const { list } = await stack.useCases.getCurrentList();
    const [category] = await stack.useCases.getCategories();
    await stack.useCases.createArticleAndAddToList(
      list.id,
      { name: 'Pain', categoryId: category?.id as never },
      null,
    );

    clock.advance(1_000);
    expect((await stack.useCases.synchronize()).outcome.type).toBe('saved');
    expect((await stack.useCases.getSyncInfo()).pendingCount).toBe(0);
  });

  it('US3-2 reports the server mismatch when the fixed address leads to another server', async () => {
    const stack = await pairedDevice();
    const other = await startTestServer({ clock });
    servers.push(other);
    const rebuilt = await buildTestAppStack({
      serverUrl: other.url,
      clock,
      database: stack.database,
      credentials: stack.credentials,
    });

    clock.advance(1_000);
    expect((await rebuilt.useCases.synchronize()).outcome).toEqual({
      type: 'signedOut',
      reason: 'revoked',
    });
  });
});
