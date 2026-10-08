import { by, device, element, expect, waitFor } from 'detox';

import {
  backToList,
  chooseList,
  createArticle,
  createList,
  expectRow,
  openAddArticles,
  openLists,
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
    // The row and the name inside it match: tapping either opens the dialog.
    await element(by.label('Lait')).atIndex(0).tap();
    await element(by.label('Ajouter')).tap();
    await waitFor(element(by.text('« Lait » ajouté')))
      .toBeVisible()
      .withTimeout(2000);

    await element(by.label("Plus d'actions pour « Lait »")).tap();
    await element(by.text('Modifier')).tap();
    await expect(element(by.text("Modifier l'article"))).toBeVisible();
    await typeInto('Nom', 'Lait demi-écrémé');
    await element(by.label('Enregistrer')).tap();

    await expect(element(by.label('Lait demi-écrémé'))).toExist();
    await backToList();
    await expectRow('Lait demi-écrémé, pas dans le caddie');
    await openLists();
    await chooseList('Ma liste, 1 article', 'Ma liste');
    await expectRow('Lait demi-écrémé, 2 L, dans le caddie');

    await device.terminateApp();
    await device.launchApp({ newInstance: true });

    await expectRow('Lait demi-écrémé, 2 L, dans le caddie');
  });
});
