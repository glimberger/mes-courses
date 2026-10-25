import { by, device, element, expect } from 'detox';

import {
  backToList,
  createArticle,
  createFromSearch,
  expectAbove,
  expectAddedRow,
  expectRow,
  openAddArticles,
  removeRow,
  search,
  tapToAdd,
  tapToRemove,
} from '../support/app';

describe('add articles and tick one', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US2-7 US2-2 creates "Lait" in Crèmerie with "2" "L" and adds it', async () => {
    await openAddArticles(true);

    await createArticle('Lait', 'Crèmerie', { amount: '2', unit: 'L' });
    await createArticle('Beurre', 'Crèmerie');

    // Created during this visit, so shown, marked as added.
    await expectAddedRow('Lait');
    await expectAddedRow('Beurre');
  });

  it('AC1 AC2 a tap adds an existing article with no quantity dialog, a second tap takes it off', async () => {
    // "Beurre" leaves the list, staying in the catalog, so it can be added again.
    await backToList();
    await removeRow('Beurre, pas dans le caddie');
    await openAddArticles();

    await tapToAdd('Beurre');
    await expect(element(by.label('Quantité'))).not.toExist();

    await tapToRemove('Beurre');
    await tapToAdd('Beurre');
  });

  it('AC3 an article already on the list is hidden, and its search says so', async () => {
    await search('Lait');

    await expect(
      element(by.text('« Lait » est déjà dans la liste')),
    ).toBeVisible();
    await expect(element(by.label('Ajouter Lait'))).not.toExist();
    await search('');
  });

  it('AC4 "Créer « Pommes »" creates the article and adds it to the list', async () => {
    await createFromSearch('Pommes', 'Fruits et légumes');

    await backToList();
    await expectRow('Beurre, pas dans le caddie');
    await expectRow('Pommes, pas dans le caddie');
    await expect(element(by.text('3 articles restants'))).toBeVisible();
  });

  it('US1-2 US1-6 US1-7 ticking "Lait" shows it in the cart, below the unticked items, and counts one item less', async () => {
    await element(by.label('Lait, 2 L, pas dans le caddie')).tap();

    await expectRow('Lait, 2 L, dans le caddie');
    await expectAbove(
      by.label('Beurre, pas dans le caddie'),
      by.label('Lait, 2 L, dans le caddie'),
    );
    await expect(element(by.text('2 articles restants'))).toBeVisible();
  });
});
