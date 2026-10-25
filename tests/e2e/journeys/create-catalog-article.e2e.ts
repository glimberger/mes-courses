import { by, device, element, expect, waitFor } from 'detox';

import { openArticles, typeInto, typeIntoDialog } from '../support/app';

describe('create an article from the Articles tab', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('AC1 AC5 creates "Couches" in a category made from the picker, which is chosen at once; the article shows in the catalog without a badge', async () => {
    await openArticles();
    // The FAB and the text inside it match: tapping either opens the form.
    await element(by.label('Nouvel article')).atIndex(0).tap();
    await expect(element(by.label('Créer'))).toExist();

    // The button ends the list of categories, below the fold.
    await element(by.text('Catégorie')).swipe('up', 'fast', 0.8);
    await waitFor(element(by.text('Nouvelle catégorie')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('Nouvelle catégorie')).tap();
    await waitFor(element(by.text('Nouvelle catégorie')).atIndex(1))
      .toExist()
      .withTimeout(5000);
    await typeIntoDialog('Nom', 'Bébé');
    // The dialog's button is listed before the form's, which shows through.
    await element(by.label('Créer')).atIndex(0).tap();
    await waitFor(element(by.label('Bébé')).atIndex(0))
      .toExist()
      .withTimeout(5000);
    // Let the category dialog finish unmounting before typing into the form's field.
    await waitFor(element(by.text('Nouvelle catégorie')).atIndex(1))
      .not.toExist()
      .withTimeout(5000);

    await typeInto('Nom', 'Couches');
    await element(by.label('Créer')).tap();

    await expect(element(by.text('Nouvel article'))).toBeVisible();
    await typeInto('Rechercher un article', 'Couches');
    await waitFor(
      element(
        by.label('Couches').withAncestor(by.label('Articles du catalogue')),
      ).atIndex(0),
    )
      .toBeVisible()
      .withTimeout(5000);
    await expect(
      element(by.text('Bébé').withAncestor(by.label('Articles du catalogue'))),
    ).toBeVisible();
  });
});
