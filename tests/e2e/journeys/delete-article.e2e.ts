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
  tapUndo,
} from '../support/app';

describe('delete an article', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US2-1 US2-3 US2-5 deletes "Lait" from the catalog, the dialog naming both lists; "Annuler" brings it back on both, as it was', async () => {
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
    await openCatalogRowMenu('Lait', 'Supprimer');
    await element(by.text('Supprimer')).tap();
    await expect(element(by.text('Supprimer « Lait » ?'))).toBeVisible();
    await expect(
      element(by.text('L’article sera retiré de 2 listes.')),
    ).toBeVisible();
    await element(by.label('Supprimer')).tap();

    await waitFor(element(by.text('« Lait » supprimé')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.label('Actions pour Lait'))).not.toExist();

    await tapUndo();

    // The row and its content match: either one shows it is back.
    await waitFor(element(by.label('Lait, dans 2 listes')).atIndex(0))
      .toBeVisible()
      .withTimeout(5000);
    await openTab('Courses');
    await expectRow('Lait, pas dans le caddie');
    await openLists();
    await chooseList('Ma liste, 1 article', 'Ma liste');
    await expectRow('Lait, 2 L, dans le caddie');
  });
});
