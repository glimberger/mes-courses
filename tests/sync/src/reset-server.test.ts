import {
  FakeClock,
  buildTestAppStack,
  type TestAppStack,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const START = Date.parse('2026-10-06T10:00:00.000Z');

describe('a server replaced by an empty one (003 FR-018a)', () => {
  let server: TestServer;
  let clock: FakeClock;

  const tick = () => clock.advance(1_000);

  const newDevice = () => buildTestAppStack({ serverUrl: server.url, clock });

  const pair = async (stack: TestAppStack, name: string) => {
    const code = await server.createPairingCode();
    const connected = await stack.useCases.connectToServer(
      server.url,
      code,
      name,
    );
    expect(connected.ok).toBe(true);
  };

  const cycle = async (stack: TestAppStack) => {
    tick();
    return (await stack.useCases.synchronize()).outcome.type;
  };

  /**
   * The first request after a restart may meet a connection the old server closed and end
   * `waiting`; the next cycle, as on a phone, goes through.
   */
  const cycleAfterRestart = async (stack: TestAppStack) => {
    const first = await cycle(stack);
    return first === 'waiting' ? cycle(stack) : first;
  };

  /** One cycle per device, in turn, until both end saved with nothing left to pull. */
  const converge = async (...stacks: TestAppStack[]) => {
    for (let round = 0; round < 4; round += 1) {
      for (const stack of stacks) expect(await cycle(stack)).toBe('saved');
    }
  };

  const addArticle = async (stack: TestAppStack, name: string) => {
    tick();
    const { list } = await stack.useCases.getCurrentList();
    const [category] = await stack.useCases.getCategories();
    const created = await stack.useCases.createArticleAndAddToList(
      list.id,
      { name, categoryId: category?.id as never },
      null,
    );
    if (!created.ok) throw new Error(`Could not add ${name}`);
  };

  const pendingCount = (stack: TestAppStack) =>
    stack.unitOfWork.run((repos) => repos.changes.count());

  const readModel = async (stack: TestAppStack) => {
    const { sections } = await stack.useCases.getCurrentList();
    return {
      categories: (await stack.useCases.getCategories()).map((c) => c.name),
      lists: (await stack.useCases.getLists()).map((l) => l.name),
      items: sections.flatMap((section) =>
        section.items.map(({ name, inCart }) => ({ name, inCart })),
      ),
    };
  };

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });

  afterEach(async () => {
    await server.close();
  });

  it('both devices keep their data, pair again and end identical, with no duplicate', async () => {
    const a = await newDevice();
    const b = await newDevice();
    await pair(a, 'A');
    await converge(a);
    await pair(b, 'B');
    await converge(a, b);
    await addArticle(a, 'Lait');
    await converge(a, b);
    await addArticle(b, 'Pain');
    await converge(a, b);
    // A change made just before the server is lost, still waiting on A.
    await addArticle(a, 'Beurre');
    const waiting = await pendingCount(a);
    expect(waiting).toBeGreaterThan(0);

    const { url } = server;
    await server.close();
    server = await startTestServer({
      clock,
      port: Number(new URL(url).port),
    });

    expect(await cycleAfterRestart(a)).toBe('disconnectedByServer');
    expect(await cycleAfterRestart(b)).toBe('disconnectedByServer');
    expect(await pendingCount(a)).toBe(waiting);
    expect((await readModel(a)).items.map((item) => item.name)).toEqual([
      'Beurre',
      'Lait',
      'Pain',
    ]);
    expect((await readModel(b)).items.map((item) => item.name)).toEqual([
      'Lait',
      'Pain',
    ]);

    await pair(a, 'A');
    await converge(a);
    await pair(b, 'B');
    await converge(a, b);

    const model = await readModel(a);
    expect(model.items.map((item) => item.name)).toEqual([
      'Beurre',
      'Lait',
      'Pain',
    ]);
    expect(new Set(model.categories).size).toBe(model.categories.length);
    expect(model.lists).toEqual(['Ma liste']);
    expect(await readModel(b)).toEqual(model);
  });
});
