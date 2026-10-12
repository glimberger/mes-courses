import type { SyncServer } from '../../../application/ports/sync-server';
import type { ArticleId } from '../../../domain/article';
import { err } from '../../../domain/result';
import type { CategoryId } from '../../../domain/category';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import type { UseCaseName } from '../use-cases';
import type { AppState } from './app-store';

const lait = 'article-lait' as ArticleId;
const barbecue = 'list-barbecue' as ListId;
const crèmerie = 'category-2' as CategoryId;

/** The names and quantities the actions below are given or read: none may reach a report. */
const content = [
  'Lait',
  'Beurre',
  'Houmous maison',
  'Lait entier',
  'Ma liste',
  'Barbecue',
  'Pique-nique',
  'Bébé',
  'Crèmerie',
  '2 kg',
  'kg',
];

/** What a 003 report must never carry either (FR-022): the address, a device name, a code, a credential. */
const syncSecrets = [
  'https://courses.example.fr',
  'courses.example.fr',
  'Tablette de Camille',
  'Téléphone de Camille',
  'K7PQ-M3XZ',
  'story-credential',
];

/** A report as an adapter would see it: its context, and the error's name, message and own fields (`UnexpectedResult.code`). */
const serialize = ({
  error,
  context,
}: {
  error: unknown;
  context: object;
}): string =>
  JSON.stringify({
    context,
    error:
      error instanceof Error
        ? { ...error, name: error.name, message: error.message }
        : String(error),
  });

const expectOnlyAllowedFields = (
  reports: { error: unknown; context: object }[],
  forbidden: string[],
) => {
  expect(reports.length).toBeGreaterThan(0);
  for (const report of reports) {
    const { context } = report;
    expect(
      Object.keys(context).every((key) =>
        ['operation', 'screen'].includes(key),
      ),
    ).toBe(true);
    expect(typeof (context as { operation?: unknown }).operation).toBe(
      'string',
    );
    const serialized = serialize(report);
    for (const text of forbidden) {
      expect(serialized).not.toContain(text);
    }
  }
};

type Case = {
  /** The use case made to fail. */
  failing: UseCaseName;
  /** Runs the store action that calls it, the current list already loaded when it can be. */
  run: (state: AppState) => Promise<unknown>;
};

/** Every store action of 001 (US1 to US4) and 002 that reads or writes, each with its use case failing. */
const cases: Record<string, Case> = {
  'US1 loadCurrentList': {
    failing: 'getCurrentList',
    run: (state) => state.loadCurrentList(),
  },
  'US1 toggleItem': {
    failing: 'toggleItemInCart',
    run: (state) => state.toggleItem(lait),
  },
  'US1 finishShopping': {
    failing: 'finishShopping',
    run: (state) => state.finishShopping(),
  },
  'US2 loadCatalog': {
    failing: 'getCatalog',
    run: (state) => state.loadCatalog(),
  },
  'US2 loadCategories': {
    failing: 'getCategories',
    run: (state) => state.loadCategories(),
  },
  'US2 addArticleToList': {
    failing: 'addArticleToList',
    run: (state) =>
      state.addArticleToList(
        { id: 'article-beurre' as ArticleId, name: 'Beurre' },
        { amount: 2, unit: 'kg' },
      ),
  },
  'US2 createArticleAndAddToList': {
    failing: 'createArticleAndAddToList',
    run: (state) =>
      state.createArticleAndAddToList(
        { name: 'Houmous maison', categoryId: crèmerie },
        { amount: 2, unit: 'kg' },
      ),
  },
  'US2 changeItemQuantity': {
    failing: 'changeItemQuantity',
    run: (state) => state.changeItemQuantity(lait, { amount: 2, unit: 'kg' }),
  },
  'US2 removeItem': {
    failing: 'removeItemFromList',
    run: (state) => state.removeItem(lait),
  },
  'US2 undo': {
    failing: 'restoreRemovedItem',
    run: async (state) => {
      await state.removeItem(lait);
      await state.undo();
    },
  },
  'US3 loadLists': {
    failing: 'getLists',
    run: (state) => state.loadLists(),
  },
  'US3 createList': {
    failing: 'createList',
    run: (state) => state.createList('Pique-nique'),
  },
  'US3 setCurrentList': {
    failing: 'setCurrentList',
    run: (state) => state.setCurrentList(barbecue),
  },
  'US4 createCategory': {
    failing: 'createCategory',
    run: (state) => state.createCategory('Bébé'),
  },
  '002 editArticle': {
    failing: 'editArticle',
    run: (state) =>
      state.editArticle(lait, { name: 'Lait entier', categoryId: crèmerie }),
  },
  '002 getArticleUsage': {
    failing: 'getArticleUsage',
    run: (state) => state.getArticleUsage(lait),
  },
  '002 deleteArticle': {
    failing: 'deleteArticle',
    run: (state) => state.deleteArticle(lait),
  },
  '002 restoreDeletedArticle': {
    failing: 'restoreDeletedArticle',
    run: async (state) => {
      await state.deleteArticle(lait);
      await state.undo();
    },
  },
};

describe('the context of every report the store makes', () => {
  it.each(Object.entries(cases))(
    'FR-030 %s reports with the operation and screen only, never a name or a quantity',
    async (_action, { failing, run }) => {
      const { store, errorReporter } = await buildStoryStore({
        seed: fixture,
        failing: [failing],
      });
      if (failing !== 'getCurrentList') {
        await store.getState().loadCurrentList();
      }

      await run(store.getState());

      expectOnlyAllowedFields(errorReporter.reports, content);
    },
  );
});

const url = 'https://courses.example.fr';
const connected = { serverUrl: url, lastSyncAt: '2026-10-01T08:00:00.000Z' };
const serverError = async () => err({ type: 'ServerError' as const });
const untrusted = async () => err({ type: 'UntrustedServer' as const });

type SyncCase = {
  /** The use case made to throw, if any. */
  failing?: UseCaseName;
  /** What the fake server answers instead of being unreachable. */
  syncServer?: Partial<SyncServer>;
  /** Unset: the device starts paired with `url`. */
  notConnected?: true;
  run: (state: AppState) => Promise<unknown>;
};

/** Every store action of 003 that can report, each made to fail as it can (FR-022). */
const syncCases: Record<string, SyncCase> = {
  '003 syncNow, the cycle throwing': {
    failing: 'synchronize',
    run: (state) => state.syncNow(),
  },
  '003 syncNow, the server failing three times': {
    syncServer: { sync: serverError },
    run: async (state) => {
      for (let i = 0; i < 3; i += 1) await state.syncNow();
    },
  },
  '003 syncNow, the sync info failing': {
    failing: 'getSyncInfo',
    syncServer: {
      sync: async () => err({ type: 'Offline' as const }),
    },
    run: (state) => state.syncNow(),
  },
  '004 signIn, throwing': {
    failing: 'signIn',
    notConnected: true,
    run: (state) =>
      state.signIn(url, 'camille@example.org', 'secret', 'Tablette de Camille'),
  },
  '004 signIn, an untrusted certificate': {
    notConnected: true,
    syncServer: { health: untrusted },
    run: (state) =>
      state.signIn(url, 'camille@example.org', 'secret', 'Tablette de Camille'),
  },
  '003 listDevices, throwing': {
    failing: 'listDevices',
    run: (state) => state.listDevices(),
  },
  '003 listDevices, an untrusted certificate': {
    syncServer: { listDevices: untrusted },
    run: (state) => state.listDevices(),
  },
  '003 renameDevice, throwing': {
    failing: 'renameDevice',
    run: (state) => state.renameDevice('device-2', 'Téléphone de Camille'),
  },
  '003 renameDevice, a server error': {
    syncServer: { renameDevice: serverError },
    run: (state) => state.renameDevice('device-2', 'Téléphone de Camille'),
  },
  '003 revokeDevice, throwing': {
    failing: 'revokeDevice',
    run: (state) => state.revokeDevice('device-2'),
  },
  '003 revokeDevice, a server error': {
    syncServer: { revokeDevice: serverError },
    run: (state) => state.revokeDevice('device-2'),
  },
  '003 disconnect, throwing': {
    failing: 'disconnect',
    run: (state) => state.disconnect(),
  },
  '003 changeServerUrl, throwing': {
    failing: 'changeServerUrl',
    run: (state) => state.changeServerUrl('https://maison.example.fr'),
  },
  '003 changeServerUrl, an untrusted certificate': {
    syncServer: { health: untrusted },
    run: (state) => state.changeServerUrl('https://maison.example.fr'),
  },
  '003 releaseHeldChanges, throwing': {
    failing: 'releaseHeldChanges',
    run: async (state) => {
      await state.removeItem(lait);
      state.dismissUndo();
      // The release is not awaited by the store.
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  },
};

describe('the context of every report the sync makes', () => {
  it.each(Object.entries(syncCases))(
    'FR-022 %s reports with the operation and screen only, never an address, a name, a code or a credential',
    async (_action, { failing, syncServer, notConnected, run }) => {
      const { store, errorReporter } = await buildStoryStore({
        seed: fixture,
        failing: failing ? [failing] : [],
        ...(syncServer && { syncServer }),
        ...(!notConnected && { connected }),
      });
      await store.getState().loadCurrentList();

      await run(store.getState());

      expectOnlyAllowedFields(errorReporter.reports, [
        ...content,
        ...syncSecrets,
        'maison.example.fr',
      ]);
    },
  );
});
