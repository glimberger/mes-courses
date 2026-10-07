import { by, device, element, expect } from 'detox';

import {
  backToList,
  createArticle,
  expectAbove,
  expectRow,
  openAddArticles,
  removeRow,
} from '../support/app';

describe('add articles and tick one', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US2-7 US2-2 creates "Lait" in Crèmerie with "2" "L" and adds it', async () => {
    await openAddArticles(true);

    await createArticle('Lait', 'Crèmerie', { amount: '2', unit: 'L' });
    await createArticle('Beurre', 'Crèmerie');

    await expect(element(by.label('Lait, déjà dans la liste'))).toBeVisible();
  });

  it('US2-1 adds an existing article of the catalog', async () => {
    // "Beurre" leaves the list, staying in the catalog, so it can be added again.
    await backToList();
    await removeRow('Beurre, pas dans le caddie');
    await openAddArticles();

    // The row and the name inside it match: tapping either opens the dialog.
    await element(by.label('Beurre')).atIndex(0).tap();
    await element(by.label('Ajouter')).tap();

    await expect(element(by.text('« Beurre » ajouté'))).toBeVisible();
    await backToList();
    await expectRow('Beurre, pas dans le caddie');
    await expect(element(by.text('2 articles restants'))).toBeVisible();
  });

  it('US1-2 US1-6 US1-7 ticking "Lait" shows it in the cart, below the unticked items, and counts one item less', async () => {
    await element(by.label('Lait, 2 L, pas dans le caddie')).tap();

    await expectRow('Lait, 2 L, dans le caddie');
    await expectAbove(
      by.label('Beurre, pas dans le caddie'),
      by.label('Lait, 2 L, dans le caddie'),
    );
    await expect(element(by.text('1 article restant'))).toBeVisible();
  });
});
