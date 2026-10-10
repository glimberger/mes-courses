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

type Device = { name: string; stack: TestAppStack; online: boolean };

describe('two devices and one server (003 US2)', () => {
  let server: TestServer;
  let clock: FakeClock;

  const newDevice = async (name: string): Promise<Device> => {
    const device: Device = { name, stack: undefined as never, online: true };
    const networkFetch: typeof fetch = async (input, init) => {
      if (!device.online) throw new TypeError('Network request failed');
      return fetch(input, init);
    };
    device.stack = await buildTestAppStack({
      serverUrl: server.url,
      clock,
      fetch: networkFetch,
    });
    return device;
  };

  /** Time moves between two actions, so every stamp is different. */
  const tick = () => clock.advance(1_000);

  const pair = async (device: Device) => {
    const code = await server.createPairingCode();
    const connected = await device.stack.useCases.connectToServer(
      server.url,
      code,
      device.name,
    );
    expect(connected.ok).toBe(true);
  };

  /** One cycle per device, in turn, until both end saved with nothing left to pull. */
  const converge = async (...devices: Device[]) => {
    for (let round = 0; round < 4; round += 1) {
      for (const device of devices) {
        tick();
        const { outcome } = await device.stack.useCases.synchronize();
        expect(outcome.type).toBe('saved');
      }
    }
  };

  /** Both devices paired and synchronized on the same, empty server. */
  const pairedPair = async () => {
    const a = await newDevice('A');
    const b = await newDevice('B');
    await pair(a);
    await converge(a);
    await pair(b);
    await converge(a, b);
    return { a, b };
  };

  const firstCategory = async (device: Device) => {
    const [first] = await device.stack.useCases.getCategories();
    if (!first) throw new Error('No category');
    return first.id;
  };

  const currentListId = async (device: Device) =>
    (await device.stack.useCases.getCurrentList()).list.id;

  const addArticle = async (
    device: Device,
    name: string,
    quantity: { amount: number; unit: string | null } | null = null,
    listId?: string,
  ) => {
    tick();
    const created = await device.stack.useCases.createArticleAndAddToList(
      (listId ?? (await currentListId(device))) as never,
      { name, categoryId: await firstCategory(device) },
      quantity,
    );
    if (!created.ok) throw new Error(`Could not add ${name}`);
    return created.value.articleId;
  };

  const articleIdOf = async (device: Device, name: string) => {
    const { sections } = await device.stack.useCases.getCurrentList();
    const item = sections
      .flatMap((section) => section.items)
      .find((row) => row.name === name);
    if (!item) throw new Error(`${name} is not on the current list`);
    return item.articleId;
  };

  const rows = async (device: Device) =>
    (await device.stack.useCases.getCurrentList()).sections.flatMap(
      (section) => section.items,
    );

  /** Every list with its content, whatever the current list (which stays as it was). */
  const readModel = async (device: Device) => {
    const { useCases } = device.stack;
    const current = await currentListId(device);
    const lists = [];
    for (const summary of (await useCases.getLists()).sort((x, y) =>
      x.name.localeCompare(y.name),
    )) {
      await useCases.setCurrentList(summary.id);
      lists.push({
        name: summary.name,
        sections: (await useCases.getCurrentList()).sections.map((section) => ({
          category: section.category.name,
          items: section.items.map(({ name, inCart, quantity }) => ({
            name,
            inCart,
            quantity,
          })),
        })),
      });
    }
    await useCases.setCurrentList(current);
    return {
      categories: (await useCases.getCategories()).map(({ name }) => name),
      lists,
    };
  };

  const expectIdentical = async (a: Device, b: Device) =>
    expect(await readModel(b)).toEqual(await readModel(a));

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });

  afterEach(async () => {
    await server.close();
  });

  it('US2-1 "Pain" added on A appears on B after B\'s next cycle', async () => {
    const { a, b } = await pairedPair();

    await addArticle(a, 'Pain');
    await converge(a);
    expect(await rows(b)).toEqual([]);
    await converge(b);

    expect(await rows(b)).toEqual([expect.objectContaining({ name: 'Pain' })]);
    await expectIdentical(a, b);
  });

  it('US2-2 A ticks, then B unticks later: unticked on both', async () => {
    const { a, b } = await pairedPair();
    await addArticle(a, 'Lait');
    await converge(a, b);
    const lait = await articleIdOf(a, 'Lait');
    const listId = await currentListId(a);
    a.online = false;
    b.online = false;

    tick();
    await a.stack.useCases.toggleItemInCart(listId, lait);
    tick();
    await b.stack.useCases.toggleItemInCart(listId, lait);
    tick();
    await b.stack.useCases.toggleItemInCart(listId, lait);
    a.online = true;
    b.online = true;
    await converge(a, b);

    expect(await rows(a)).toEqual([
      expect.objectContaining({ name: 'Lait', inCart: false }),
    ]);
    await expectIdentical(a, b);
  });

  it('US2-3 a rename on A and a quantity change on B: "Lait entier, 2 L" on both', async () => {
    const { a, b } = await pairedPair();
    await addArticle(a, 'Lait');
    await converge(a, b);
    const lait = await articleIdOf(a, 'Lait');
    const listId = await currentListId(a);
    a.online = false;
    b.online = false;

    tick();
    await a.stack.useCases.editArticle(lait, {
      name: 'Lait entier',
      categoryId: await firstCategory(a),
    });
    tick();
    await b.stack.useCases.changeItemQuantity(listId, lait, {
      amount: 2,
      unit: 'L',
    });
    a.online = true;
    b.online = true;
    await converge(a, b);

    expect(await rows(a)).toEqual([
      expect.objectContaining({
        name: 'Lait entier',
        quantity: { amount: 2, unit: 'L' },
      }),
    ]);
    await expectIdentical(a, b);
  });

  it('US2-4 the same article, category and list created on both devices become one, with the items kept', async () => {
    const { a, b } = await pairedPair();
    a.online = false;
    b.online = false;

    await addArticle(a, 'Houmous', { amount: 1, unit: null });
    await addArticle(b, ' houmous ', { amount: 3, unit: null });
    tick();
    await a.stack.useCases.createCategory('Épicerie bio');
    tick();
    await b.stack.useCases.createCategory(' épicerie bio ');
    tick();
    await a.stack.useCases.createList('Anniversaire');
    tick();
    await b.stack.useCases.createList(' anniversaire ');
    a.online = true;
    b.online = true;
    await converge(a, b);

    const model = await readModel(a);
    expect(
      model.categories.filter((name) => name.trim() === 'Épicerie bio'),
    ).toHaveLength(1);
    expect(
      model.lists.filter((list) => list.name.trim() === 'Anniversaire'),
    ).toHaveLength(1);
    const houmous = (await rows(a)).filter((row) => row.name === 'Houmous');
    expect(houmous).toHaveLength(1);
    await expectIdentical(a, b);
  });

  it('US2-5 A deletes "Lait" while B ticks it later: deleted on both', async () => {
    const { a, b } = await pairedPair();
    await addArticle(a, 'Lait');
    await converge(a, b);
    const lait = await articleIdOf(a, 'Lait');
    const listId = await currentListId(a);
    a.online = false;
    b.online = false;

    tick();
    const deleted = await a.stack.useCases.deleteArticle(lait);
    if (!deleted.ok) throw new Error('Could not delete Lait');
    await a.stack.useCases.releaseHeldChanges(undoIdOf(deleted.value));
    tick();
    await b.stack.useCases.toggleItemInCart(listId, lait);
    a.online = true;
    b.online = true;
    await converge(a, b);

    expect(await rows(a)).toEqual([]);
    expect(await rows(b)).toEqual([]);
    await expectIdentical(a, b);
  });

  it('US2-6 A removes "Pain" while B changes its quantity: removed on both', async () => {
    const { a, b } = await pairedPair();
    await addArticle(a, 'Pain');
    await converge(a, b);
    const pain = await articleIdOf(a, 'Pain');
    const listId = await currentListId(a);
    a.online = false;
    b.online = false;

    tick();
    const removed = await a.stack.useCases.removeItemFromList(listId, pain);
    if (!removed.ok) throw new Error('Could not remove Pain');
    await a.stack.useCases.releaseHeldChanges(undoIdOf(removed.value));
    tick();
    await b.stack.useCases.changeItemQuantity(listId, pain, {
      amount: 4,
      unit: null,
    });
    a.online = true;
    b.online = true;
    await converge(a, b);

    expect(await rows(a)).toEqual([]);
    expect(await rows(b)).toEqual([]);
    await expectIdentical(a, b);
  });

  it('US2-7 A finishes shopping, then B ticks "Œufs" later: only "Œufs" is ticked', async () => {
    const { a, b } = await pairedPair();
    const listId = await currentListId(a);
    const lait = await addArticle(a, 'Lait');
    const oeufs = await addArticle(a, 'Œufs');
    tick();
    await a.stack.useCases.toggleItemInCart(listId as never, lait);
    await converge(a, b);
    a.online = false;
    b.online = false;

    tick();
    await a.stack.useCases.finishShopping(listId);
    tick();
    await b.stack.useCases.toggleItemInCart(listId, oeufs);
    a.online = true;
    b.online = true;
    await converge(a, b);

    expect(await rows(a)).toEqual([
      expect.objectContaining({ name: 'Lait', inCart: false }),
      expect.objectContaining({ name: 'Œufs', inCart: true }),
    ]);
    await expectIdentical(a, b);
  });

  it('US2-8 two new categories end after the existing ones, in the same order on both', async () => {
    const { a, b } = await pairedPair();
    const existing = (await a.stack.useCases.getCategories()).length;
    a.online = false;
    b.online = false;

    tick();
    await a.stack.useCases.createCategory('Surgelés bis');
    tick();
    await b.stack.useCases.createCategory('Boissons bis');
    a.online = true;
    b.online = true;
    await converge(a, b);

    const categories = await a.stack.useCases.getCategories();
    expect(categories).toHaveLength(existing + 2);
    expect(
      categories
        .slice(existing)
        .map(({ name }) => name)
        .sort(),
    ).toEqual(['Boissons bis', 'Surgelés bis']);
    expect(await b.stack.useCases.getCategories()).toEqual(categories);
  });

  it('US2-9 each device keeps its own current list', async () => {
    const { a, b } = await pairedPair();
    const ma = await currentListId(a);

    tick();
    const created = await a.stack.useCases.createList('Fête');
    if (!created.ok) throw new Error('Could not create Fête');
    await a.stack.useCases.setCurrentList(created.value.listId);
    await converge(a, b);

    expect(await currentListId(a)).toBe(created.value.listId);
    expect(await currentListId(b)).toBe(ma);
    expect(
      (await b.stack.useCases.getLists()).map((l) => l.name).sort(),
    ).toEqual(['Fête', 'Ma liste']);
  });

  it('US2-10 two "Barbecue" lists made offline become one, and B\'s current list follows, with no message', async () => {
    const { a, b } = await pairedPair();
    a.online = false;
    b.online = false;

    tick();
    const fromA = await a.stack.useCases.createList('Barbecue');
    tick();
    const fromB = await b.stack.useCases.createList('Barbecue');
    if (!fromA.ok || !fromB.ok) throw new Error('Could not create Barbecue');
    await b.stack.useCases.setCurrentList(fromB.value.listId);
    await addArticle(a, 'Saucisses', null, fromA.value.listId);
    await addArticle(b, 'Chips', null, fromB.value.listId);
    a.online = true;
    b.online = true;
    await converge(a, b);

    const barbecues = (await b.stack.useCases.getLists()).filter(
      (list) => list.name === 'Barbecue',
    );
    expect(barbecues).toHaveLength(1);
    expect(await currentListId(b)).toBe(barbecues[0]?.id);
    expect((await rows(b)).map((row) => row.name).sort()).toEqual([
      'Chips',
      'Saucisses',
    ]);
    await expectIdentical(a, b);
  });

  it("FR-017 SC-007 a device with its own seeded defaults and data joins a server holding another's data, with no duplicate", async () => {
    const a = await newDevice('A');
    await pair(a);
    await converge(a);
    await addArticle(a, 'Lait');
    await converge(a);

    const b = await newDevice('B');
    await addArticle(b, 'Chips');
    await pair(b);
    await converge(a, b);

    const model = await readModel(a);
    expect(new Set(model.categories).size).toBe(model.categories.length);
    expect(model.lists.map((list) => list.name)).toEqual(['Ma liste']);
    expect((await rows(a)).map((row) => row.name).sort()).toEqual([
      'Chips',
      'Lait',
    ]);
    await expectIdentical(a, b);
  });
});
