import type { ReactTestInstance } from 'react-test-renderer';
import { PixelRatio, StyleSheet, TextInput } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { err, ok } from '../../../domain/result';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { waitForMenusToSettle } from '../testing/wait-for-menus';

// Every screen and dialog, checked for FR-031, FR-032 and FR-034. Jest lays nothing out, so a
// touch target is read from the sizes the styles set (research R2): a component must state its
// 48 dp, which also documents it.

const ROLES = ['button', 'checkbox', 'radio', 'switch', 'link', 'tab'] as const;

// Each view opens the app and walks to a screen: on CI that outlasts Jest's 5 s default.
jest.setTimeout(30_000);

/** These views open more layers than the others: CI is slower than the default wait. */
const slow = { timeout: 5000 };

const press = async (name: string) => {
  await screen.findAllByRole('button', { name });
  const button = screen.getAllByRole('button', { name }).at(-1);
  if (!button) throw new Error(`No button "${name}"`);
  fireEvent.press(button);
};

/** A tab of the bottom bar. */
const pressTab = async (name: string) => {
  fireEvent.press(await screen.findByRole('tab', { name }));
};

const header = (name: string) =>
  screen
    .findAllByRole('header', { name }, slow)
    .then((found) => found.length > 0);

/** The app on the fixture, opened on CurrentList. */
const openApp = async (scenario: StoryScenario = {}) => {
  await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false, ...scenario },
  );
  await screen.findByRole('checkbox', {
    name: 'Lait, 2 L, pas dans le caddie',
  });
};

/** A device paired with a server that lists two devices (003). */
const connected: StoryScenario = {
  connected: { serverUrl: 'https://courses.example.fr', lastSyncAt: null },
  syncServer: {
    listDevices: async () =>
      ok([
        {
          id: 'story-device',
          name: 'Pixel de Léa',
          createdAt: '2026-09-01T10:00:00.000Z',
          lastSyncAt: null,
        },
        {
          id: 'device-2',
          name: 'iPhone de Marc',
          createdAt: '2026-09-02T10:00:00.000Z',
          lastSyncAt: '2026-09-30T08:00:00.000Z',
        },
      ]),
  },
};

const openSettings = async (scenario: StoryScenario = connected) => {
  await openApp(scenario);
  await pressTab('Réglages');
  await header('Réglages');
};

/** Settings of a connected device, its devices listed. */
const openDevices = async () => {
  await openSettings();
  await screen.findByText('iPhone de Marc', {}, slow);
};

/** Settings of a signed-in account, whose address the server tells. */
const openSignedIn = async () => {
  await openSettings({
    ...connected,
    accountServer: {
      getAccount: async () =>
        ok({ id: 'account-1', email: 'lea@example.org', role: 'user' }),
    },
  });
  await screen.findByText('lea@example.org', {}, slow);
};

/** Opens the menu of a device row and, when `shown` is another text, chooses `action`. */
const chooseDeviceAction = async (action: string, shown: string) => {
  await openDevices();
  await waitForMenusToSettle();
  fireEvent.press(screen.getByLabelText('Actions de iPhone de Marc'));
  if (action !== shown)
    fireEvent.press(await screen.findByText(action, {}, slow));
  await screen.findByText(shown, {}, slow);
};

/** Each screen and dialog, opened through the app as a user opens it. */
const views: Record<string, () => Promise<void>> = {
  CurrentList: openApp,
  Lists: async () => {
    await openApp();
    await pressTab('Listes');
    await screen.findByRole('button', { name: 'Barbecue, 0 articles' });
  },
  AddArticles: async () => {
    await openApp();
    await press('Ajouter');
    await screen.findByRole('button', { name: 'Beurre' });
  },
  'AddArticles with a search': async () => {
    await openApp();
    await press('Ajouter');
    fireEvent.changeText(
      await screen.findByPlaceholderText('Rechercher un article'),
      'beu',
    );
    await screen.findByRole('button', { name: 'Effacer la recherche' });
  },
  CreateArticle: async () => {
    await openApp();
    await press('Ajouter');
    await press('Nouvel article');
    await screen.findByRole('radio', { name: 'Boissons' });
  },
  FinishShoppingDialog: async () => {
    await openApp();
    await press('Terminer les courses');
    await header('Terminer les courses ?');
  },
  QuantityDialog: async () => {
    await openApp();
    await press('Ajouter');
    await press('Beurre');
    await header('Beurre');
  },
  CreateListDialog: async () => {
    await openApp();
    await pressTab('Listes');
    await press('Nouvelle liste');
    await screen.findByRole('button', { name: 'Créer' });
  },
  'AddArticles row menu': async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      screen.getByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    await screen.findByText('Modifier', {}, slow);
  },
  EditArticle: async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      screen.getByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    fireEvent.press(screen.getByText('Modifier'));
    await screen.findByRole('radio', { name: 'Boissons' }, slow);
  },
  DeleteArticleDialog: async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      screen.getByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    fireEvent.press(screen.getByText('Supprimer'));
    await header('Supprimer « Lait » ?');
  },
  'undo snackbar after a deletion': async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      screen.getByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    fireEvent.press(screen.getByText('Supprimer'));
    await screen.findByText('Supprimer « Lait » ?', {}, slow);
    await press('Supprimer');
    await screen.findByText('« Lait » supprimé', {}, slow);
    await screen.findByRole('button', { name: 'Annuler' });
  },
  '003 SyncStatusBar': async () => {
    await openApp(connected);
    await screen.findByTestId('sync-status-bar');
  },
  '003 SyncStatusBar, disconnected by the server': async () => {
    await openApp({
      ...connected,
      syncServer: {
        ...connected.syncServer,
        sync: async () => err({ type: 'DeviceNotAuthorized' }),
      },
    });
    await screen.findByRole('button', { name: 'Se reconnecter' }, slow);
  },
  '003 SyncStatusBar, failed': async () => {
    await openApp({
      ...connected,
      syncServer: {
        ...connected.syncServer,
        sync: async () => err({ type: 'ServerError' }),
      },
      // The status turns `failed` on the third failure in a row.
      prepare: async ({ syncNow }) => {
        await syncNow();
        await syncNow();
      },
    });
    await screen.findByRole('button', { name: 'Réessayer' }, slow);
  },
  '003 Settings, never connected': async () => {
    await openSettings({});
    await screen.findByRole('button', { name: 'Se connecter' });
  },
  '003 Settings, connected': openDevices,
  '004 SignIn': async () => {
    await openSettings({});
    await press('Se connecter');
    await header('Connexion');
  },
  '003 device row menu': () => chooseDeviceAction('Renommer', 'Renommer'),
  '003 RenameDeviceDialog': () =>
    chooseDeviceAction('Renommer', "Renommer l'appareil"),
  '003 RevokeDeviceDialog': () =>
    chooseDeviceAction('Révoquer', 'Révoquer « iPhone de Marc » ?'),
  '004 ChangePasswordDialog': async () => {
    await openSignedIn();
    await press('Changer de mot de passe');
    await screen.findByLabelText('Mot de passe actuel', {}, slow);
  },
  '004 SignOutDialog': async () => {
    await openSignedIn();
    await press('Se déconnecter de cet appareil');
    await screen.findByText('Se déconnecter de cet appareil ?', {}, slow);
  },
  '004 DeleteMyAccountDialog': async () => {
    await openSignedIn();
    await press('Supprimer mon compte');
    await screen.findByText('Supprimer votre compte ?', {}, slow);
  },
  CreateCategoryDialog: async () => {
    await openApp();
    await press('Ajouter');
    await press('Nouvel article');
    await press('Nouvelle catégorie');
    await screen.findByRole('button', { name: 'Créer' });
  },
};

/** Whether taps reach the element: neither it nor an ancestor is hidden or lets them through. */
const takesTaps = (node: ReactTestInstance): boolean => {
  for (let at: ReactTestInstance | null = node; at; at = at.parent) {
    const style = StyleSheet.flatten(at.props.style) ?? {};
    if (
      at.props.pointerEvents === 'none' ||
      style.pointerEvents === 'none' ||
      style.display === 'none'
    ) {
      return false;
    }
  }
  return true;
};

/** Every interactive element drawn, hidden ones included: they still take taps. */
const interactiveElements = (): ReactTestInstance[] =>
  [
    ...ROLES.flatMap((role) =>
      screen.queryAllByRole(role, { includeHiddenElements: true }),
    ),
    ...screen.UNSAFE_queryAllByType(TextInput),
  ].filter(takesTaps);

/** The visible text inside an element. */
const textOf = (node: ReactTestInstance): string =>
  node.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join(' ')
    .trim();

/** What a screen reader reads for the element: its label, or its text. */
const nameOf = (node: ReactTestInstance): string => {
  const label: unknown =
    node.props.accessibilityLabel ?? node.props['aria-label'];
  return typeof label === 'string' && label.trim() !== ''
    ? label
    : textOf(node);
};

/** Labels the libraries give when the app gives none: English, so never acceptable. */
const ENGLISH_DEFAULTS =
  /^(back|close|close modal|close menu|clear|search|dismiss|menu|more options|open|loading|ok|cancel)$/i;

const describeNode = (node: ReactTestInstance) =>
  `${String(node.type)} "${nameOf(node)}"`;

type Side = 'height' | 'width';

/** The size the element's own style sets on one side, 0 when it sets none. */
const ownSize = (node: ReactTestInstance, side: Side): number => {
  const style = StyleSheet.flatten(node.props.style) ?? {};
  const min = side === 'height' ? style.minHeight : style.minWidth;
  return Math.max(Number(style[side] ?? 0), Number(min ?? 0));
};

/** The element's only child, leaving out components that draw nothing (Pressable's debug view). */
const onlyChild = (node: ReactTestInstance): ReactTestInstance | null => {
  const children = node.children.filter(
    (child): child is ReactTestInstance =>
      typeof child !== 'string' &&
      (typeof child.type === 'string' || child.children.length > 0),
  );
  return children.length === 1 ? (children[0] ?? null) : null;
};

/** Whether the element stretches over a layer that covers the screen, as a dialog's backdrop. */
const coversScreen = (node: ReactTestInstance): boolean => {
  const own = StyleSheet.flatten(node.props.style) ?? {};
  // A menu's backdrop: stretched over the screen and holding no text.
  if (
    textOf(node) === '' &&
    own.position === 'absolute' &&
    [own.top, own.bottom, own.left, own.right].every((at) => at === 0)
  ) {
    return true;
  }
  // The nearest element above with a style of its own: wrappers repeat the element's.
  const ownJson = JSON.stringify(own);
  let above = node.parent;
  while (
    above &&
    JSON.stringify(StyleSheet.flatten(above.props.style) ?? {}) === ownJson
  ) {
    above = above.parent;
  }
  const layer = above && StyleSheet.flatten(above.props.style);
  return (
    Number(own.flex ?? 0) >= 1 &&
    layer?.position === 'absolute' &&
    [layer.top, layer.bottom, layer.left, layer.right].every((at) => at === 0)
  );
};

/**
 * The size Jest can tell, with no layout: the largest set on the element, on the wrappers that
 * hold only it, or on the single elements it holds, which it takes the size of.
 */
const declaredSize = (node: ReactTestInstance, side: Side): number => {
  if (coversScreen(node)) return Infinity;
  let size = ownSize(node, side);
  for (let at = node.parent; at && onlyChild(at) !== null; at = at.parent) {
    size = Math.max(size, ownSize(at, side));
  }
  for (let at = onlyChild(node); at; at = onlyChild(at)) {
    size = Math.max(size, ownSize(at, side));
  }
  return size;
};

/**
 * Fields and text buttons are wider than their text: only icon-only buttons need a width set.
 */
const iconOnly = (node: ReactTestInstance) =>
  node.type !== TextInput && !/\p{L}/u.test(textOf(node));

/** A disabled element, such as the search bar's magnifier, takes no tap. */
const disabled = (node: ReactTestInstance) =>
  node.props.accessibilityState?.disabled === true ||
  node.props['aria-disabled'] === true;

describe.each(Object.entries(views))('%s', (_view, open) => {
  it('FR-032 FR-031 gives every interactive element a French label or a visible French text', async () => {
    await open();

    const unnamed = interactiveElements()
      .filter((node) => {
        const name = nameOf(node);
        return !/\p{L}/u.test(name) || ENGLISH_DEFAULTS.test(name);
      })
      .map(describeNode);

    expect(unnamed).toEqual([]);
  });

  it('FR-034 gives every interactive element a touch target of at least 48 × 48 dp', async () => {
    await open();

    const small = interactiveElements()
      .filter((node) => !disabled(node))
      .filter(
        (node) =>
          declaredSize(node, 'height') < 48 ||
          (iconOnly(node) && declaredSize(node, 'width') < 48),
      )
      .map(describeNode);

    expect(small).toEqual([]);
  });
});

// The screens and the four mockup dialogs at a 200% text size (FR-013, SC-007). Each renders its
// content in a scroll area, so taller text scrolls: the tests check that nothing cuts a text
// short and no target shrinks.
/** Whether the text is part of a field's label: Paper keeps it on one line by design, and draws an empty copy. */
const isFieldLabel = (node: ReactTestInstance) => {
  const text = textOf(node);
  if (text === '') return true;
  for (let at = node.parent; at; at = at.parent) {
    if (at.props.label === text) return true;
  }
  return false;
};

const LARGE_TEXT_VIEWS = [
  'CurrentList',
  'Lists',
  'AddArticles',
  '004 SignIn',
  '003 Settings, connected',
  'FinishShoppingDialog',
  'QuantityDialog',
  'CreateListDialog',
  'DeleteArticleDialog',
] as const;

describe.each(LARGE_TEXT_VIEWS)('%s at fontScale 2', (name) => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const openView = async () => {
    const open = views[name];
    if (!open) throw new Error(`No view "${name}"`);
    await open();
  };

  it('FR-013 keeps every interactive element at 48 dp or more', async () => {
    await openView();

    const small = interactiveElements()
      .filter((node) => !disabled(node))
      .filter(
        (node) =>
          declaredSize(node, 'height') < 48 ||
          (iconOnly(node) && declaredSize(node, 'width') < 48),
      )
      .map(describeNode);

    expect(small).toEqual([]);
  });

  it('SC-007 cuts no title, name or message short', async () => {
    await openView();

    const cut = screen.UNSAFE_root.findAll(
      (node) =>
        String(node.type) === 'Text' &&
        node.props.numberOfLines !== undefined &&
        !isFieldLabel(node),
    ).map((node) => `${String(node.type)} "${textOf(node)}"`);

    expect(cut).toEqual([]);
  });
});
