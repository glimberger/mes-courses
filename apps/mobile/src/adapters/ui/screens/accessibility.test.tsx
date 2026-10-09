import type { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, TextInput } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';

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

const header = (name: string) =>
  screen
    .findAllByRole('header', { name }, slow)
    .then((found) => found.length > 0);

/** The app on the fixture, opened on CurrentList. */
const openApp = async () => {
  await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false },
  );
  await screen.findByRole('checkbox', {
    name: 'Lait, 2 L, pas dans le caddie',
  });
};

/** Each screen and dialog, opened through the app as a user opens it. */
const views: Record<string, () => Promise<void>> = {
  CurrentList: openApp,
  Lists: async () => {
    await openApp();
    await press('Mes listes');
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
    await press('Mes listes');
    await press('Nouvelle liste');
    await screen.findByRole('button', { name: 'Créer' });
  },
  'AddArticles row menu': async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      await screen.findByRole('button', {
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
      await screen.findByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    fireEvent.press(await screen.findByText('Modifier'));
    await screen.findByRole('radio', { name: 'Boissons' }, slow);
  },
  DeleteArticleDialog: async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      await screen.findByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    fireEvent.press(await screen.findByText('Supprimer'));
    await header('Supprimer « Lait » ?');
  },
  'undo snackbar after a deletion': async () => {
    await openApp();
    await press('Ajouter');
    // The catalog is fully drawn: a row redrawn later would close its menu.
    await screen.findByText('Beurre', {}, slow);
    fireEvent.press(
      await screen.findByRole('button', {
        name: "Plus d'actions pour « Lait »",
      }),
    );
    fireEvent.press(await screen.findByText('Supprimer'));
    await screen.findByText('Supprimer « Lait » ?', {}, slow);
    await press('Supprimer');
    await screen.findByText('« Lait » supprimé', {}, slow);
    await screen.findByRole('button', { name: 'Annuler' });
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
