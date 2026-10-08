import { by, device, element, expect, waitFor } from 'detox';

import {
  backToList,
  createArticle,
  expectRow,
  openAddArticles,
  removeRow,
  tapUndo,
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

    await removeRow('Beurre, 2 kg, dans le caddie');
    // The snackbar slides in.
    await waitFor(element(by.text('« Beurre » retiré de la liste')))
      .toBeVisible()
      .withTimeout(2000);
    await expect(
      element(by.label('Beurre, 2 kg, dans le caddie')),
    ).not.toExist();

    await tapUndo();

    await expectRow('Beurre, 2 kg, dans le caddie');
  });
});
