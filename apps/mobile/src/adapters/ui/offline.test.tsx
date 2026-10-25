import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../application/testing/recording-error-reporter';
import type { SyncServer } from '../../application/ports/sync-server';
import type { ArticleId } from '../../domain/article';
import { err } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import { Navigation } from './navigation';
import { fixture } from './testing/fixtures';
import { renderWithStore } from './testing/render-with-store';
import type { Fixture, StoryScenario } from './testing/story-store';
import type { AppStore } from './state/app-store';

const realFetch = global.fetch;
const offlineFetch = jest.fn(() => {
  throw new TypeError('Network request failed');
});

beforeEach(() => {
  offlineFetch.mockClear();
  global.fetch = offlineFetch as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

const maListe = 'list-ma-liste' as ListId;

const farine = fixture.articles.find((article) => article.name === 'Farine');
if (!farine) throw new Error('No Farine in the fixture');

/**
 * The fixture with four categories only and without its long-named item, so every row of
 * AddArticles and CurrentList fits the rows Jest draws, and "Pâte" in the catalog only, to be
 * found by searching.
 */
const seed: Fixture = {
  ...fixture,
  categories: fixture.categories.filter((category) =>
    ['Fruits et légumes', 'Crèmerie', 'Épicerie salée', 'Boissons'].includes(
      category.name,
    ),
  ),
  items: fixture.items.filter((item) => item.articleId !== 'article-yaourt'),
  articles: [
    ...fixture.articles,
    {
      id: 'article-pate' as ArticleId,
      name: 'Pâte',
      categoryId: farine.categoryId,
    },
  ],
};

const errorTexts = [
  "La modification n'a pas pu être enregistrée.",
  'Impossible de charger la liste.',
  'Impossible de charger les articles.',
  'Impossible de charger vos listes.',
  'Une erreur est survenue.',
];

const row = (name: string) => screen.findByRole('checkbox', { name });

const press = async (name: string) =>
  fireEvent.press(await screen.findByRole('button', { name }));

const pressTab = async (name: string) =>
  fireEvent.press(await screen.findByRole('tab', { name }));

/** Presses the last button so named: a dialog's, drawn in a portal, comes after the screen's. */
const pressLast = async (name: string) => {
  await screen.findAllByRole('button', { name });
  const button = screen.getAllByRole('button', { name }).at(-1);
  if (!button) throw new Error(`No button "${name}"`);
  fireEvent.press(button);
};

/** Types in the last field so labelled: a dialog's comes after the form's. */
const type = (label: string, text: string) => {
  const field = screen.getAllByLabelText(label).at(-1);
  if (!field) throw new Error(`No field "${label}"`);
  fireEvent.changeText(field, text);
};

/** Runs one of the row's accessibility actions, as a screen reader does. */
const runAction = async (
  label: string,
  actionName: 'editQuantity' | 'remove',
) =>
  fireEvent(await row(label), 'accessibilityAction', {
    nativeEvent: { actionName },
  });

/** From AddArticles, adds the article of this row with no quantity. */
const addFromCatalog = async (name: string) => {
  await press(name);
  await pressLast('Ajouter');
  await screen.findByText(`« ${name} » ajouté`);
};

type Network = {
  scenario: () => StoryScenario;
  /** Checks what the sync did once every action is done. */
  expectSync: (store: AppStore) => Promise<void>;
};

/** Every authenticated request answers `Offline`, as with no network (003 FR-003). */
const offlineServer = () => {
  const offline = async () => err({ type: 'Offline' as const });
  return {
    sync: jest.fn(offline),
    listDevices: jest.fn(offline),
    renameDevice: jest.fn(offline),
    revokeDevice: jest.fn(offline),
  } satisfies Partial<SyncServer>;
};

const networks: [string, () => Network][] = [
  [
    'never connected to a server',
    () => ({
      scenario: () => ({}),
      expectSync: async (store) => {
        expect(store.getState().sync.connection).toBe('notConnected');
      },
    }),
  ],
  [
    'connected to a server it cannot reach (003)',
    () => {
      const server = offlineServer();
      return {
        scenario: () => ({
          connected: {
            serverUrl: 'https://courses.example.fr',
            lastSyncAt: null,
          },
          syncServer: server,
        }),
        expectSync: async (store) => {
          expect(server.sync).toHaveBeenCalled();
          await waitFor(() =>
            expect(store.getState().sync.status).toBe('waiting'),
          );
          expect(store.getState().sync.connection).toBe('connected');
          expect(store.getState().sync.pendingCount).toBeGreaterThan(0);
        },
      };
    },
  ],
];

// Twelve actions through the whole app: a busy machine (CI, a build running) outlasts Jest's 5 s default.
jest.setTimeout(30_000);

describe.each(networks)(
  'the app with no network, %s',
  (_network, makeNetwork) => {
    it('FR-027 SC-006 003 FR-003 SC-004 completes each of the 12 actions of the spec, in order, with nothing reported', async () => {
      const network = makeNetwork();
      const navigationReporter = new RecordingErrorReporter();
      const { errorReporter, unitOfWork, store } = await renderWithStore(
        <Navigation errorReporter={navigationReporter} />,
        { seed, asScreen: false, ...network.scenario() },
      );

      // 1. Open the application on the current list.
      expect(await row('Lait, 2 L, pas dans le caddie')).toBeOnTheScreen();
      expect(screen.getByText('Ma liste')).toBeOnTheScreen();

      // 2. Tick and untick an item.
      fireEvent.press(await row('Lait, 2 L, pas dans le caddie'));
      fireEvent.press(await row('Pommes, dans le caddie'));
      expect(await row('Lait, 2 L, dans le caddie')).toBeChecked();
      expect(await row('Pommes, pas dans le caddie')).not.toBeChecked();

      // 3. Finish shopping.
      await press('Terminer les courses');
      await pressLast('Terminer');
      expect(await row('Lait, 2 L, pas dans le caddie')).not.toBeChecked();

      // 4. Add an existing article, by browsing categories and by searching.
      await press('Ajouter');
      await addFromCatalog('Beurre');
      fireEvent.changeText(
        screen.getByPlaceholderText('Rechercher un article'),
        'pâ',
      );
      await addFromCatalog('Pâte');

      // 5. Create an article and add it to the current list.
      await press('Nouvel article');
      type('Nom', 'Lentilles');
      fireEvent.press(
        await screen.findByRole('radio', { name: 'Épicerie salée' }),
      );
      type('Quantité', '400');
      type('Unité', 'g');
      await press('Créer et ajouter');
      await screen.findByText('« Lentilles » ajouté');
      await press('Retour');
      expect(
        await row('Lentilles, 400 g, pas dans le caddie'),
      ).toBeOnTheScreen();
      // "Pâte" comes last, past the rows Jest draws: it is checked in storage.
      expect(
        await unitOfWork.run((repos) =>
          repos.items.find(maListe, 'article-pate' as ArticleId),
        ),
      ).toMatchObject({ inCart: false, quantity: null });

      // 6. Set, change and clear the quantity of an item.
      await runAction('Beurre, pas dans le caddie', 'editQuantity');
      type('Quantité', '2');
      type('Unité', 'kg');
      await pressLast('Enregistrer');
      await runAction('Beurre, 2 kg, pas dans le caddie', 'editQuantity');
      type('Quantité', '3');
      await pressLast('Enregistrer');
      await runAction('Beurre, 3 kg, pas dans le caddie', 'editQuantity');
      await pressLast('Effacer la quantité');
      expect(await row('Beurre, pas dans le caddie')).toBeOnTheScreen();

      // 7. Remove an item from the current list.
      await runAction('Farine, 1,5 kg, pas dans le caddie', 'remove');
      await screen.findByText('« Farine » retiré de la liste');
      expect(
        screen.queryByRole('checkbox', {
          name: 'Farine, 1,5 kg, pas dans le caddie',
        }),
      ).not.toBeOnTheScreen();

      // 8. Undo a removal.
      await press('Annuler');
      expect(await row('Farine, 1,5 kg, pas dans le caddie')).toBeOnTheScreen();

      // 9. See all lists.
      await pressTab('Listes');
      expect(
        await screen.findByRole('button', {
          name: 'Ma liste, 6 articles, liste en cours',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Barbecue, 0 articles' }),
      ).toBeOnTheScreen();

      // 10. Create a list.
      await press('Nouvelle liste');
      type('Nom', 'Pique-nique');
      await pressLast('Créer');

      // 11. Choose the current list.
      await press('Pique-nique, 0 articles');
      expect(await screen.findByText('Votre liste est vide')).toBeOnTheScreen();
      expect(screen.getByText('Pique-nique')).toBeOnTheScreen();

      // 12. Create a category.
      await press('Ajouter des articles');
      await press('Nouvel article');
      await press('Nouvelle catégorie');
      type('Nom', 'Bébé');
      await pressLast('Créer');
      expect(await screen.findByRole('radio', { name: 'Bébé' })).toBeChecked();

      const stored = await unitOfWork.run(async (repos) => ({
        categories: (await repos.categories.all()).map(
          (category) => category.name,
        ),
        lists: (await repos.lists.all()).map((list) => list.name),
        current: await repos.appState.currentListId(),
      }));
      expect(stored.categories).toContain('Bébé');
      expect(stored.lists).toContain('Pique-nique');
      expect(stored.current).not.toBe(maListe);
      for (const text of errorTexts) {
        expect(screen.queryByText(text)).not.toBeOnTheScreen();
      }
      await waitFor(() => expect(errorReporter.reports).toEqual([]));
      expect(navigationReporter.reports).toEqual([]);
      expect(offlineFetch).not.toHaveBeenCalled();
      await network.expectSync(store);
    });

    it('002 FR-010 SC-004 003 FR-003 renames, recategorizes and deletes an article, then undoes it, with nothing reported', async () => {
      const network = makeNetwork();
      const navigationReporter = new RecordingErrorReporter();
      const { errorReporter, unitOfWork, store } = await renderWithStore(
        <Navigation errorReporter={navigationReporter} />,
        { seed, asScreen: false, ...network.scenario() },
      );
      const storedBeurre = () =>
        unitOfWork.run((repos) =>
          repos.articles.findById('article-beurre' as ArticleId),
        );
      const chooseFromMenu = async (name: string, action: string) => {
        fireEvent.press(
          await screen.findByRole('button', {
            name: `Actions pour ${name}`,
          }),
        );
        fireEvent.press(screen.getByText(action));
      };
      fireEvent.press(await screen.findByRole('tab', { name: 'Articles' }));

      // Rename.
      await chooseFromMenu('Beurre', 'Modifier');
      await screen.findByText("Modifier l'article");
      fireEvent.changeText(screen.getByLabelText('Nom'), 'Beurre doux');
      // Change the category.
      fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
      await press('Enregistrer');
      expect(await screen.findByText('Beurre doux')).toBeOnTheScreen();
      expect(screen.queryByText("Modifier l'article")).toBeNull();
      const renamed = await storedBeurre();
      expect(renamed?.name).toBe('Beurre doux');
      const boissons = seed.categories.find((c) => c.name === 'Boissons');
      expect(renamed?.categoryId).toBe(boissons?.id);

      // Delete, then undo.
      await chooseFromMenu('Beurre doux', 'Supprimer');
      await screen.findByText('Supprimer « Beurre doux » ?');
      await pressLast('Supprimer');
      await screen.findByText('« Beurre doux » supprimé');
      expect(await storedBeurre()).toBeNull();
      await pressLast('Annuler');
      expect(await screen.findByText('Beurre doux')).toBeOnTheScreen();
      expect((await storedBeurre())?.name).toBe('Beurre doux');

      for (const text of errorTexts) {
        expect(screen.queryByText(text)).not.toBeOnTheScreen();
      }
      await waitFor(() => expect(errorReporter.reports).toEqual([]));
      expect(navigationReporter.reports).toEqual([]);
      expect(offlineFetch).not.toHaveBeenCalled();
      await network.expectSync(store);
    });
  },
);

describe('a signed-in device reopened with no network (004 US2-6, FR-007)', () => {
  it('goes straight to its lists, asks for no sign-in, and keeps working', async () => {
    const offline = async () => err({ type: 'Offline' as const });
    const { errorReporter } = await renderWithStore(
      <Navigation errorReporter={new RecordingErrorReporter()} />,
      {
        seed,
        asScreen: false,
        connected: {
          serverUrl: 'https://courses.example.fr',
          lastSyncAt: null,
        },
        syncServer: { sync: offline, listDevices: offline },
        accountServer: { getAccount: offline },
      },
    );

    expect(await screen.findByText('Ma liste')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Se connecter' }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Connexion' })).toBeNull();
    await waitFor(() => expect(errorReporter.reports).toEqual([]));
  });
});
