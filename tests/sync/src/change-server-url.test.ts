import { signInDevice } from './testing/onboard';
import {
  FakeClock,
  buildTestAppStack,
  type TestAppStack,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const START = Date.parse('2026-10-06T10:00:00.000Z');

describe('a server that changes address (003 spec edge case "domain name changes")', () => {
  let clock: FakeClock;
  const servers: Array<{ close(): Promise<void> }> = [];
  let server: TestServer;

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
    servers.push(server);
  });
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => s.close()));
  });

  // The stored address; Settings no longer shows it (013), and this use case goes in T010.
  const storedAddress = async (stack: TestAppStack) =>
    (await stack.unitOfWork.run((repos) => repos.syncState.get())).serverUrl;

  const pairedDevice = async () => {
    const stack = await buildTestAppStack({ serverUrl: server.url, clock });
    const connected = await signInDevice(server, stack, 'Pixel');
    expect(connected.ok).toBe(true);
    clock.advance(1_000);
    expect((await stack.useCases.synchronize()).outcome.type).toBe('saved');
    return stack;
  };

  it('switches to the new address, keeping its credential, and syncs', async () => {
    const stack = await pairedDevice();
    const credential = await stack.credentials.read();
    const moved = await server.listenAlso();
    servers.push(moved);

    expect(await stack.useCases.changeServerUrl(moved.url)).toEqual({
      ok: true,
      value: undefined,
    });

    expect(await stack.credentials.read()).toBe(credential);
    expect(await storedAddress(stack)).toBe(moved.url);
    clock.advance(1_000);
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

  it('refuses a server with another identity and changes nothing', async () => {
    const stack = await pairedDevice();
    const other = await startTestServer({ clock });
    servers.push(other);
    const before = await storedAddress(stack);

    expect(await stack.useCases.changeServerUrl(other.url)).toEqual({
      ok: false,
      error: { type: 'ServerMismatch' },
    });

    expect(await storedAddress(stack)).toBe(before);
    clock.advance(1_000);
    expect((await stack.useCases.synchronize()).outcome.type).toBe('saved');
  });
});
