import type { Change, Hlc } from '@mes-courses/sync-core';
import {
  FakeClock,
  buildTestAppStack,
  type TestAppStack,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const START = Date.parse('2026-10-06T10:00:00.000Z');

const ARTICLES = 500;
const LISTS = 5;
const ITEMS = 300;
/** SC-005: under 30 seconds to restore one user's data on a new device. */
const RESTORE_BUDGET_MS = 30_000;

/** The changes of one user's data, as another device would have pushed them. */
const userData = (deviceId: string): Change[] => {
  const hlc = (counter: number): Hlc => ({ wallMs: START, counter, deviceId });
  let counter = 0;
  const change = <C extends Omit<Change, 'changeId' | 'hlc'>>(rest: C) =>
    ({
      changeId: `change-${counter}`,
      hlc: hlc(counter++),
      ...rest,
    }) as Change;
  const changes: Change[] = [
    change({
      kind: 'category',
      id: 'category-vrac',
      fields: { name: 'Vrac', position: 0 },
    }),
  ];
  for (let a = 0; a < ARTICLES; a += 1) {
    changes.push(
      change({
        kind: 'article',
        id: `article-${a}`,
        fields: { name: `Article ${a}`, categoryId: 'category-vrac' },
      }),
    );
  }
  for (let l = 0; l < LISTS; l += 1) {
    changes.push(
      change({ kind: 'list', id: `list-${l}`, fields: { name: `Liste ${l}` } }),
    );
  }
  for (let i = 0; i < ITEMS; i += 1) {
    const listId = `list-${i % LISTS}`;
    const articleId = `article-${i}`;
    changes.push(
      change({
        kind: 'listItem',
        id: `${listId}:${articleId}`,
        fields: {
          listId,
          articleId,
          present: true,
          inCart: i % 3 === 0,
          quantity: i % 2 === 0 ? { amount: 2, unit: 'kg' } : null,
        },
      }),
    );
  }
  return changes;
};

describe('restoring and writing at size (003 SC-004, SC-005)', () => {
  let server: TestServer;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });

  afterEach(async () => {
    await server.close();
  });

  /** Pushes the user's data straight to the API, as a device paired before would have. */
  const seedServer = async () => {
    await server.createAccount({ email: 'seeder@example.org' });
    const signIn = await fetch(`${server.url}/v1/auth/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'seeder@example.org',
        password: 'a long enough password',
        deviceName: 'Seeder',
      }),
    });
    const { deviceId, credential } = (await signIn.json()) as {
      deviceId: string;
      credential: string;
    };
    const changes = userData(deviceId);
    for (let at = 0; at < changes.length; at += 500) {
      const response = await fetch(`${server.url}/v1/sync`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${credential}`,
        },
        body: JSON.stringify({
          lastSeq: 0,
          hlc: { wallMs: START, counter: 0, deviceId },
          changes: changes.slice(at, at + 500),
        }),
      });
      expect(response.status).toBe(200);
    }
  };

  const pair = async (stack: TestAppStack) => {
    const connected = await stack.useCases.signIn(
      server.url,
      'seeder@example.org',
      'a long enough password',
      'Nouvelle tablette',
    );
    expect(connected.ok).toBe(true);
  };

  it('SC-005 a new device restores 500 articles, 5 lists and 300 items in at most 2 sync requests', async () => {
    await seedServer();
    let syncRequests = 0;
    const device = await buildTestAppStack({
      serverUrl: server.url,
      clock,
      fetch: (input, init) => {
        if (String(input).endsWith('/v1/sync')) syncRequests += 1;
        return fetch(input, init);
      },
    });
    await pair(device);
    const started = performance.now();

    // The scheduler's cycle loop: cycles until one ends saved.
    for (let cycle = 0; cycle < 10; cycle += 1) {
      clock.advance(1_000);
      const { outcome } = await device.useCases.synchronize();
      if (outcome.type === 'saved') break;
    }

    expect(performance.now() - started).toBeLessThan(RESTORE_BUDGET_MS);
    expect(syncRequests).toBeLessThanOrEqual(2);
    const restored = await device.unitOfWork.run(async (repos) => {
      const lists = (await repos.lists.all()).filter((list) =>
        list.name.startsWith('Liste '),
      );
      let items = 0;
      for (const list of lists)
        items += (await repos.items.forList(list.id)).length;
      return {
        articles: (await repos.articles.all()).filter((article) =>
          article.name.startsWith('Article '),
        ).length,
        lists: lists.length,
        items,
        pending: await repos.changes.count(),
      };
    });
    expect(restored).toEqual({
      articles: ARTICLES,
      lists: LISTS,
      items: ITEMS,
      pending: 0,
    });
  });

  it('SC-004 a local tick completes while a sync cycle waits on the network', async () => {
    await seedServer();
    let releaseNetwork!: () => void;
    const networkBack = new Promise<void>((resolve) => {
      releaseNetwork = resolve;
    });
    let hold = false;
    const device = await buildTestAppStack({
      serverUrl: server.url,
      clock,
      fetch: async (input, init) => {
        if (hold && String(input).endsWith('/v1/sync')) await networkBack;
        return fetch(input, init);
      },
    });
    await pair(device);
    await device.useCases.synchronize();
    const { list } = await device.useCases.getCurrentList();
    const [category] = await device.useCases.getCategories();
    if (!category) throw new Error('No category');
    const created = await device.useCases.createArticleAndAddToList(
      list.id,
      { name: 'Lait', categoryId: category.id },
      null,
    );
    if (!created.ok) throw new Error('Could not add Lait');

    hold = true;
    clock.advance(1_000);
    const cycle = device.useCases.synchronize();
    const tick = device.useCases.toggleItemInCart(
      list.id,
      created.value.articleId,
    );
    try {
      const outcome = await Promise.race([
        tick.then(() => 'ticked' as const),
        cycle.then(() => 'cycle ended first' as const),
      ]);

      expect(outcome).toBe('ticked');
      expect((await tick).ok).toBe(true);
    } finally {
      // Released even when an assertion fails, so `server.close()` is not left waiting on it.
      releaseNetwork();
    }
    await cycle;
  });
});
