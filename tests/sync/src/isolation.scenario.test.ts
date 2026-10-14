import {
  FakeClock,
  buildTestAppStack,
  type TestAppStack,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import { signInDevice } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');

describe('data separation across accounts (004 US3)', () => {
  let server: TestServer;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });
  afterEach(async () => {
    await server.close();
  });

  const device = async (email: string, name: string) => {
    const stack = await buildTestAppStack({ serverUrl: server.url, clock });
    expect((await signInDevice(server, stack, name, email)).ok).toBe(true);
    return stack;
  };

  const sync = async (stack: TestAppStack) => {
    clock.advance(1000);
    const { outcome } = await stack.useCases.synchronize();
    expect(outcome.type).toBe('saved');
  };

  const listId = async (stack: TestAppStack) =>
    (await stack.useCases.getCurrentList()).list.id;

  const add = async (stack: TestAppStack, name: string) => {
    clock.advance(1000);
    const [category] = await stack.useCases.getCategories();
    const created = await stack.useCases.createArticleAndAddToList(
      await listId(stack),
      { name, categoryId: category?.id as never },
      null,
    );
    if (!created.ok) throw new Error(`Could not add ${name}`);
    return created.value.articleId;
  };

  const lastSeq = async (stack: TestAppStack) =>
    (
      await stack.database.getFirstAsync<{ last_seq: number }>(
        'SELECT last_seq FROM sync_state WHERE id = 1',
        [],
      )
    )?.last_seq ?? 0;

  const rows = async (stack: TestAppStack) =>
    (await stack.useCases.getCurrentList()).sections.flatMap(
      (section) => section.items,
    );

  const everything = async (stack: TestAppStack) =>
    JSON.stringify({
      lists: await stack.useCases.getLists(),
      current: await stack.useCases.getCurrentList(),
      categories: await stack.useCases.getCategories(),
      catalog: await stack.useCases.getCatalog(await listId(stack)),
    });

  it('004 US3-1 each account receives only its own data, in the snapshot and in later pulls', async () => {
    const marie = await device('marie@example.org', 'Pixel');
    const paul = await device('paul@example.org', 'iPhone');
    await add(marie, 'Lait');
    await add(paul, 'Bière');
    await sync(marie);
    await sync(paul);

    // A fresh device per account takes the snapshot.
    const marieTablet = await device('marie@example.org', 'Tablette');
    const paulTablet = await device('paul@example.org', 'iPad');
    await sync(marieTablet);
    await sync(paulTablet);
    expect((await rows(marieTablet)).map((row) => row.name)).toEqual(['Lait']);
    expect((await rows(paulTablet)).map((row) => row.name)).toEqual(['Bière']);

    // Later pulls too.
    await add(marie, 'Pain');
    await add(paul, 'Vin');
    await sync(marie);
    await sync(paul);
    await sync(marieTablet);
    await sync(paulTablet);
    expect(await everything(marieTablet)).not.toMatch(/Bière|Vin/);
    expect(await everything(paulTablet)).not.toMatch(/Lait|Pain/);
    expect((await rows(marieTablet)).map((row) => row.name).sort()).toEqual([
      'Lait',
      'Pain',
    ]);
  });

  it('004 US3-4 two accounts with an article "Lait": a change on one never reaches the other, and nothing is merged across', async () => {
    const marie = await device('marie@example.org', 'Pixel');
    const paul = await device('paul@example.org', 'iPhone');
    const marieLait = await add(marie, 'Lait');
    await add(paul, 'Lait');
    await sync(marie);
    await sync(paul);
    expect((await rows(paul)).map((row) => row.name)).toEqual(['Lait']);

    clock.advance(1000);
    await marie.useCases.editArticle(marieLait, {
      name: 'Lait entier',
      categoryId: (await marie.useCases.getCategories())[0]?.id as never,
    });
    await sync(marie);
    await sync(paul);
    expect((await rows(marie)).map((row) => row.name)).toEqual(['Lait entier']);
    expect((await rows(paul)).map((row) => row.name)).toEqual(['Lait']);

    clock.advance(1000);
    await marie.useCases.deleteArticle(marieLait);
    await sync(marie);
    await sync(paul);
    expect(await rows(marie)).toEqual([]);
    expect((await rows(paul)).map((row) => row.name)).toEqual(['Lait']);
  });

  it('004 US3-1 / SC-003 the seq gaps a device sees reveal counts only, never a row, an id or a name of another account', async () => {
    const marie = await device('marie@example.org', 'Pixel');
    const paul = await device('paul@example.org', 'iPhone');
    await add(marie, 'Lait');
    await sync(marie);
    const before = await lastSeq(marie);
    const paulArticle = await add(paul, 'Secret de Paul');
    await sync(paul);
    await add(marie, 'Pain');
    await sync(marie);

    const after = await lastSeq(marie);
    // Paul's writes moved the one global counter: Marie sees a gap, and only that.
    expect(after - before).toBeGreaterThan(1);
    const seen = await everything(marie);
    expect(seen).not.toContain('Secret de Paul');
    expect(seen).not.toContain(paulArticle);
  });
});
