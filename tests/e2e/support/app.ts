import { by, element, expect, waitFor } from 'detox';

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

/** Types into the field with this label, then closes the keyboard. */
export const typeInto = async (label: string, text: string) => {
  await element(by.label(label)).replaceText(text);
  await element(by.label(label)).tapReturnKey();
};

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
  await element(by.label(category)).tap();
  await typeInto('Nom', name);
  if (quantity) {
    await typeInto('Quantité', quantity.amount);
    await typeInto('Unité', quantity.unit);
  }
  await element(by.label('Créer et ajouter')).tap();
  await expect(element(by.text(`« ${name} » ajouté`))).toBeVisible();
};

/** From the current list, opens AddArticles, with the FAB or from the empty list. */
export const openAddArticles = async (fromEmptyList = false) => {
  await element(
    by.label(fromEmptyList ? 'Ajouter des articles' : 'Ajouter'),
  ).tap();
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
