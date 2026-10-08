import { by, device, element, expect } from 'detox';

import {
  backToList,
  chooseList,
  createArticle,
  createList,
  expectRow,
  openAddArticles,
  openLists,
} from '../support/app';

describe('several lists', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US3-2 US3-8 creates "Barbecue", empty and not current, while "Lait" is ticked on "Ma liste"', async () => {
    await openAddArticles(true);
    await createArticle('Lait', 'Crèmerie', { amount: '2', unit: 'L' });
    await backToList();
    await element(by.label('Lait, 2 L, pas dans le caddie')).tap();
    await expectRow('Lait, 2 L, dans le caddie');

    await openLists();
    await createList('Barbecue');

    await expectRow('Barbecue, 0 articles');
    await expect(
      element(by.label('Ma liste, 1 article, liste actuelle')),
    ).toBeVisible();
  });

  it('US3-3 makes "Barbecue" current from "Mes listes", and US2-5 adds "Lait" to it, unticked', async () => {
    await chooseList('Barbecue, 0 articles', 'Barbecue');
    await expect(element(by.text('Votre liste est vide'))).toBeVisible();

    await openAddArticles(true);
    // The row and the name inside it match: tapping either opens the dialog.
    await element(by.label('Lait')).atIndex(0).tap();
    await element(by.label('Ajouter')).tap();
    await backToList();

    await expectRow('Lait, pas dans le caddie');
  });

  it('US3-4 switching back shows "Ma liste" untouched, "Lait" still ticked there', async () => {
    await openLists();
    await expect(
      element(by.label('Barbecue, 1 article, liste actuelle')),
    ).toBeVisible();

    await chooseList('Ma liste, 1 article', 'Ma liste');

    await expectRow('Lait, 2 L, dans le caddie');
    await expect(element(by.text('Tout est dans le caddie'))).toBeVisible();
  });
});
