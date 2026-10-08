import { by, device, element, expect, waitFor } from 'detox';

import {
  backToList,
  chooseList,
  createArticle,
  createList,
  expectRow,
  openAddArticles,
  openLists,
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
    // The row and the name inside it match: tapping either opens the dialog.
    await element(by.label('Lait')).atIndex(0).tap();
    await element(by.label('Ajouter')).tap();
    await waitFor(element(by.text('« Lait » ajouté')))
      .toBeVisible()
      .withTimeout(2000);

    await element(by.label("Plus d'actions pour « Lait »")).tap();
    await element(by.text('Supprimer')).tap();
    await expect(element(by.text('Supprimer « Lait » ?'))).toBeVisible();
    await expect(
      element(
        by.text(
          'Il est dans les listes « Barbecue » et « Ma liste » et en sera retiré.',
        ),
      ),
    ).toBeVisible();
    await element(by.label('Supprimer')).tap();

    await waitFor(element(by.text('« Lait » supprimé')))
      .toBeVisible()
      .withTimeout(2000);
    await expect(
      element(by.label("Plus d'actions pour « Lait »")),
    ).not.toExist();
    await backToList();
    // The offer lasts 5 s (FR-010): no other screen is visited before "Annuler". The other
    // list losing the article is covered by the use case tests.
    await expect(element(by.label('Lait, pas dans le caddie'))).not.toExist();

    await tapUndo();

    await expectRow('Lait, pas dans le caddie');
    await openLists();
    await chooseList('Ma liste, 1 article', 'Ma liste');
    await expectRow('Lait, 2 L, dans le caddie');
  });
});
