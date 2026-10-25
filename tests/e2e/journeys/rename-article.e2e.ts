import { by, device, element, expect, waitFor } from 'detox';

import {
  backToList,
  chooseList,
  createArticle,
  createList,
  expectRow,
  openAddArticles,
  openArticles,
  openCatalogRowMenu,
  openTab,
  openLists,
  tapToAdd,
  typeInto,
} from '../support/app';

describe('rename an article', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US1-1 US1-2 SC-005 renames "Lait" from the catalog; both lists show it, ticked and with its quantity, and it stays renamed after a restart', async () => {
    await openAddArticles(true);
    await createArticle('Lait', 'Crèmerie', { amount: '2', unit: 'L' });
    await backToList();
    await element(by.label('Lait, 2 L, pas dans le caddie')).tap();
    await expectRow('Lait, 2 L, dans le caddie');

    await openLists();
    await createList('Barbecue');
    await chooseList('Barbecue, 0 articles', 'Barbecue');
    await openAddArticles(true);
    await tapToAdd('Lait');

    await backToList();

    await openArticles();
    await openCatalogRowMenu('Lait', 'Modifier');
    await element(by.text('Modifier')).tap();
    await expect(element(by.text("Modifier l'article"))).toBeVisible();
    // The note sits under the fields, which the keyboard of a field in focus can cover.
    await expect(
      element(by.text('Ce changement s’applique à 2 listes.')),
    ).toExist();
    await typeInto('Nom', 'Lait demi-écrémé');
    await element(by.label('Enregistrer')).tap();

    // The row and its content match: either one shows the new name.
    await waitFor(
      element(by.label('Lait demi-écrémé, dans 2 listes')).atIndex(0),
    )
      .toBeVisible()
      .withTimeout(5000);
    await openTab('Courses');
    await expectRow('Lait demi-écrémé, pas dans le caddie');
    await openLists();
    await chooseList('Ma liste, 1 article', 'Ma liste');
    await expectRow('Lait demi-écrémé, 2 L, dans le caddie');

    await device.terminateApp();
    await device.launchApp({ newInstance: true });

    await expectRow('Lait demi-écrémé, 2 L, dans le caddie');
  });
});
