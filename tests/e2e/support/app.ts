import { by, device, element, expect, waitFor } from 'detox';

// Steps the journeys share. They find elements by French text and accessibility label only, and
// wait only through Detox's synchronization: no sleep, no retry (research R23).

/** The top of the element on screen, to compare where two elements are. */
export const topOf = async (matcher: Detox.NativeMatcher): Promise<number> => {
  const attributes = await element(matcher).getAttributes();
  if ('elements' in attributes) {
    throw new Error('More than one element matches');
  }
  return attributes.frame.y;
};

/**
 * Fails unless `upper` is shown above `lower`. An `upper` no longer on screen counts as above
 * when `upperScrolledOff` says it can only have left through the top.
 */
export const expectAbove = async (
  upper: Detox.NativeMatcher,
  lower: Detox.NativeMatcher,
  { upperScrolledOff = false } = {},
) => {
  const upperTop = await topOf(upper).catch((error: unknown) => {
    if (upperScrolledOff) return -Infinity;
    throw error;
  });
  const lowerTop = await topOf(lower);
  if (!(upperTop < lowerTop)) {
    throw new Error(`Expected ${upperTop} to be above ${lowerTop}`);
  }
};

/**
 * The text field with this label. Its floating label reads the same, so the field is told apart
 * by its native type too.
 */
const field = (label: string) =>
  element(
    by
      .label(label)
      .and(
        by.type(
          device.getPlatform() === 'android'
            ? 'android.widget.EditText'
            : 'RCTUITextField',
        ),
      ),
  );

/**
 * Sets the text of the field with this label without focusing it: a panel to type on would
 * open, and its closing would move the screen under the next tap.
 */
export const typeInto = (label: string, text: string) =>
  field(label).replaceText(text);

/**
 * From AddArticles, creates the article in the category, with the quantity if given, and adds it
 * to the current list; ends back on AddArticles.
 */
export const createArticle = async (
  name: string,
  category: string,
  quantity?: { amount: string; unit: string },
) => {
  await element(by.label('Nouvel article')).tap();
  // The radio item and the text inside it match: tapping either chooses the category.
  await element(by.label(category)).atIndex(0).tap();
  await typeInto('Nom', name);
  if (quantity) {
    await typeInto('Quantité', quantity.amount);
    await typeInto('Unité', quantity.unit);
  }
  await element(by.label('Créer et ajouter')).tap();
  // The snackbar slides in.
  await waitFor(element(by.text(`« ${name} » ajouté`)))
    .toBeVisible()
    .withTimeout(2000);
};

/** From the current list, opens AddArticles, with the FAB or from the empty list. */
export const openAddArticles = async (fromEmptyList = false) => {
  // The FAB and the text inside it match: tapping either opens the screen.
  await element(by.label(fromEmptyList ? 'Ajouter des articles' : 'Ajouter'))
    .atIndex(0)
    .tap();
  await expect(element(by.text('Ajouter des articles'))).toBeVisible();
};

/** From AddArticles, goes back to the current list. */
export const backToList = async () => {
  await element(by.label('Retour')).tap();
};

/** Waits for the row of the current list with this label. */
export const expectRow = (label: string) =>
  waitFor(element(by.label(label)))
    .toBeVisible()
    .withTimeout(2000);

/** Taps "Annuler" in the undo snackbar, once it has slid fully in. */
export const tapUndo = async () => {
  await waitFor(element(by.text('Annuler')))
    .toBeVisible(100)
    .withTimeout(2000);
  await element(by.text('Annuler')).tap();
};

/**
 * Removes the item of this row through its accessibility action "Retirer de la liste", as a
 * screen reader does. iOS names a custom action by its label, Android by its name.
 */
export const removeRow = (rowLabel: string) =>
  element(by.label(rowLabel)).performAccessibilityAction(
    device.getPlatform() === 'ios' ? 'Retirer de la liste' : 'remove',
  );

/** Taps a tab of the bottom bar. The tab and the label inside it match: either one opens it. */
export const openTab = (name: 'Courses' | 'Listes' | 'Articles' | 'Réglages') =>
  element(by.label(name)).atIndex(0).tap();

/** Opens Lists with the "Listes" tab of the bottom bar. */
export const openLists = async () => {
  await openTab('Listes');
  await expect(element(by.text('Nouvelle liste'))).toBeVisible();
};

/** From Lists, creates an empty list with the FAB "Nouvelle liste"; ends back on Lists. */
export const createList = async (name: string) => {
  // The FAB and the text inside it match: tapping either opens the dialog.
  await element(by.label('Nouvelle liste')).atIndex(0).tap();
  await typeInto('Nom', name);
  await element(by.label('Créer')).tap();
};

/**
 * From Lists, makes the list of this row current, which goes back to the current list, showing
 * it under its name.
 */
export const chooseList = async (rowLabel: string, name: string) => {
  await element(by.label(rowLabel)).tap();
  // Lists shows the name too: the current list is shown once Lists and its FAB are hidden (the
  // Lists tab stays mounted behind the Courses tab).
  await waitFor(element(by.text('Nouvelle liste')))
    .not.toBeVisible()
    .withTimeout(2000);
  await expect(element(by.text(name))).toBeVisible();
};

/**
 * From AddArticles, searches the catalog for this article, so its row moves to the top of the
 * screen: lower down, the snackbar of the last action can cover it and take the tap.
 */
const searchCatalog = (name: string) => typeInto('Rechercher un article', name);

/**
 * From AddArticles, taps the catalog row of this article and waits for the quantity dialog
 * ("Ajouter"): the dialog mounts in a portal after the tap.
 */
export const openQuantityDialog = async (name: string) => {
  await searchCatalog(name);
  // The row and the name inside it match: tapping either opens the dialog. The search field
  // holds the name too, so the match is kept inside the list.
  await element(by.label(name).withAncestor(by.label('Articles du catalogue')))
    .atIndex(0)
    .tap();
  await waitFor(element(by.label('Ajouter')))
    .toBeVisible()
    .withTimeout(2000);
};

/**
 * From AddArticles, opens the menu of the catalog row of this article and waits for its entry
 * (e.g. "Modifier" or "Supprimer"): the menu mounts in a portal after the tap.
 */
export const openRowMenu = async (name: string, entry: string) => {
  await searchCatalog(name);
  await element(by.label(`Plus d'actions pour « ${name} »`)).tap();
  await waitFor(element(by.text(entry)))
    .toBeVisible()
    .withTimeout(2000);
};
