import { by, device, element, expect } from 'detox';

import {
  backToList,
  createArticle,
  expectRow,
  openAddArticles,
} from '../support/app';

describe('remove an item and undo', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US2-6 US2-16 "Annuler" puts back a removed item, ticked, with its quantity', async () => {
    await openAddArticles(true);
    await createArticle('Beurre', 'Crèmerie', { amount: '2', unit: 'kg' });
    await createArticle('Lait', 'Crèmerie');
    await backToList();
    await element(by.label('Beurre, 2 kg, pas dans le caddie')).tap();
    await expectRow('Beurre, 2 kg, dans le caddie');

    await element(
      by.label('Beurre, 2 kg, dans le caddie'),
    ).performAccessibilityAction('remove');
    await expect(
      element(by.text('« Beurre » retiré de la liste')),
    ).toBeVisible();
    await expect(
      element(by.label('Beurre, 2 kg, dans le caddie')),
    ).not.toExist();

    await element(by.text('Annuler')).tap();

    await expectRow('Beurre, 2 kg, dans le caddie');
  });
});
