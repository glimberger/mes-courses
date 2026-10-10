import type { Change } from '@mes-courses/sync-core';
import {
  FakeClock,
  buildTestAppStack,
  type TestAppStack,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const START = Date.parse('2026-10-06T10:00:00.000Z');

/** The id of an undo offer, which 003 adds to `RemovedItem` and `DeletedArticle` (T062, T067). */
const undoIdOf = (value: object): string =>
  (value as { undoId: string }).undoId;

describe('one device and its server (003 US1)', () => {
  let server: TestServer;
  let clock: FakeClock;
  let online: boolean;
  /** The changes that reached the server, in the order they arrived. */
  let received: Change[];

  const networkFetch: typeof fetch = async (input, init) => {
    if (!online) throw new TypeError('Network request failed');
    if (String(input).endsWith('/v1/sync') && typeof init?.body === 'string') {
      received.push(
        ...(JSON.parse(init.body) as { changes: Change[] }).changes,
      );
    }
    return fetch(input, init);
  };

  const stackOn = (
    overrides: Partial<Parameters<typeof buildTestAppStack>[0]> = {},
  ) =>
    buildTestAppStack({
      serverUrl: server.url,
      clock,
      fetch: networkFetch,
      ...overrides,
    });

  /** Time moves between two actions, so every stamp is different. */
  const tick = () => clock.advance(1_000);

  const pair = async (stack: TestAppStack, deviceName = 'Pixel') => {
    const code = await server.createPairingCode();
    const connected = await stack.useCases.connectToServer(
      server.url,
      code,
      deviceName,
    );
    expect(connected.ok).toBe(true);
  };

  /** Runs cycles until one ends saved. */
  const settle = async (stack: TestAppStack) => {
    for (let cycle = 0; cycle < 10; cycle += 1) {
      tick();
      const { outcome } = await stack.useCases.synchronize();
      if (outcome.type === 'saved') return;
      expect(outcome.type).toBe('saved');
    }
  };

  const pendingCount = (stack: TestAppStack) =>
    stack.unitOfWork.run((repos) => repos.changes.count());

  /** What a device paired later, and synchronized, shows of the server's data. */
  const probe = async () => {
    const stack = await stackOn();
    await pair(stack, 'Probe');
    await settle(stack);
    return stack;
  };

  const firstCategory = async (stack: TestAppStack) => {
    const [first] = await stack.useCases.getCategories();
    if (!first) throw new Error('No category');
    return first.id;
  };

  const addArticle = async (
    stack: TestAppStack,
    name: string,
    quantity: { amount: number; unit: string | null } | null = null,
  ) => {
    tick();
    const { list } = await stack.useCases.getCurrentList();
    const created = await stack.useCases.createArticleAndAddToList(
      list.id,
      { name, categoryId: await firstCategory(stack) },
      quantity,
    );
    if (!created.ok) throw new Error(`Could not add ${name}`);
    return { listId: list.id, articleId: created.value.articleId };
  };

  const rows = async (stack: TestAppStack) =>
    (await stack.useCases.getCurrentList()).sections.flatMap(
      (section) => section.items,
    );

  beforeEach(async () => {
    clock = new FakeClock(START);
    online = true;
    received = [];
    server = await startTestServer({ clock });
  });

  afterEach(async () => {
    await server.close();
  });

  it('US1-1 a tick reaches the server after one cycle', async () => {
    const device = await stackOn();
    await pair(device);
    await settle(device);
    const { listId, articleId } = await addArticle(device, 'Lait');
    await settle(device);

    tick();
    await device.useCases.toggleItemInCart(listId, articleId);
    const { outcome } = await device.useCases.synchronize();

    expect(outcome).toEqual({ type: 'saved' });
    expect(await pendingCount(device)).toBe(0);
    expect(await rows(await probe())).toEqual([
      expect.objectContaining({ name: 'Lait', inCart: true }),
    ]);
  });

  it('US1-2 US1-3 changes made while the server is unreachable wait, then arrive in order, none twice', async () => {
    const device = await stackOn();
    await pair(device);
    await settle(device);
    const { listId, articleId: lait } = await addArticle(device, 'Lait');
    const { articleId: beurre } = await addArticle(device, 'Beurre');
    await settle(device);
    received = [];

    online = false;
    const { articleId: pain } = await addArticle(device, 'Pain');
    tick();
    expect((await device.useCases.toggleItemInCart(listId, pain)).ok).toBe(
      true,
    );
    tick();
    const renamed = await device.useCases.editArticle(lait, {
      name: 'Lait entier',
      categoryId: await firstCategory(device),
    });
    expect(renamed.ok).toBe(true);
    tick();
    const removed = await device.useCases.removeItemFromList(listId, beurre);
    if (!removed.ok) throw new Error('Could not remove Beurre');
    await device.useCases.releaseHeldChanges(undoIdOf(removed.value));
    tick();
    const { outcome } = await device.useCases.synchronize();

    expect(outcome).toEqual({ type: 'waiting' });
    expect(await pendingCount(device)).toBeGreaterThan(0);
    expect(received).toEqual([]);

    online = true;
    await settle(device);

    const ids = received.map((change) => change.changeId);
    expect(new Set(ids).size).toBe(ids.length);
    const stamps = received.map((change) => change.hlc.wallMs);
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    expect(await pendingCount(device)).toBe(0);
    expect(await rows(await probe())).toEqual([
      expect.objectContaining({ name: 'Lait entier', inCart: false }),
      expect.objectContaining({ name: 'Pain', inCart: true }),
    ]);
  });

  it('US1-4 an app killed with changes waiting sends them when it starts again', async () => {
    const device = await stackOn();
    await pair(device);
    await settle(device);
    online = false;
    await addArticle(device, 'Lait');
    await device.useCases.synchronize();
    const waiting = await pendingCount(device);
    expect(waiting).toBeGreaterThan(0);

    const restarted = await stackOn({
      database: device.database,
      credentials: device.credentials,
    });
    expect(await pendingCount(restarted)).toBe(waiting);
    online = true;
    await settle(restarted);

    expect(await pendingCount(restarted)).toBe(0);
    expect(await rows(await probe())).toEqual([
      expect.objectContaining({ name: 'Lait' }),
    ]);
  });

  it('US1-5 SC-007 a fresh install paired with the server gets everything back, with no second default', async () => {
    const device = await stackOn();
    await pair(device);
    await settle(device);
    const { listId, articleId } = await addArticle(device, 'Lait', {
      amount: 2,
      unit: 'L',
    });
    tick();
    await device.useCases.toggleItemInCart(listId, articleId);
    await addArticle(device, 'Pommes');
    await settle(device);

    const reinstalled = await stackOn();
    await pair(reinstalled, 'Pixel (réinstallé)');
    await settle(reinstalled);

    expect(await rows(reinstalled)).toEqual(await rows(device));
    expect(await reinstalled.useCases.getCategories()).toEqual(
      await device.useCases.getCategories(),
    );
    const lists = await reinstalled.useCases.getLists();
    expect(lists.map((summary) => summary.name)).toEqual(['Ma liste']);
    expect((await reinstalled.useCases.getCurrentList()).list.name).toBe(
      'Ma liste',
    );
  });

  it('US1-6 data made before pairing reaches an empty server', async () => {
    const device = await stackOn();
    const { listId, articleId } = await addArticle(device, 'Lait', {
      amount: 1,
      unit: null,
    });
    tick();
    await device.useCases.toggleItemInCart(listId, articleId);

    await pair(device);
    await settle(device);

    expect(await rows(await probe())).toEqual([
      expect.objectContaining({
        name: 'Lait',
        inCart: true,
        quantity: { amount: 1, unit: null },
      }),
    ]);
  });

  it('US1-7 an item removed then restored through "Annuler" is never seen deleted by the server', async () => {
    const device = await stackOn();
    await pair(device);
    await settle(device);
    const { listId, articleId } = await addArticle(device, 'Lait');
    await settle(device);
    received = [];

    tick();
    const removed = await device.useCases.removeItemFromList(listId, articleId);
    if (!removed.ok) throw new Error('Could not remove Lait');
    tick();
    expect((await device.useCases.restoreRemovedItem(removed.value)).ok).toBe(
      true,
    );
    await settle(device);

    expect(
      received.filter(
        (change) =>
          change.kind === 'listItem' &&
          (change.fields as { present?: boolean }).present === false,
      ),
    ).toEqual([]);
    expect(await rows(await probe())).toEqual([
      expect.objectContaining({ name: 'Lait' }),
    ]);
  });
});
