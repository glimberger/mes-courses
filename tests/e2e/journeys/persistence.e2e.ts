import { by, device, element, expect } from 'detox';

import {
  backToList,
  createArticle,
  expectRow,
  openAddArticles,
} from '../support/app';

describe('persistence', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US1-4 SC-007 FR-028 keeps the items and their ticks when the app process is ended', async () => {
    await openAddArticles(true);
    await createArticle('Lait', 'Crèmerie', { amount: '2', unit: 'L' });
    await createArticle('Pain', 'Boulangerie');
    await backToList();
    await element(by.label('Lait, 2 L, pas dans le caddie')).tap();
    await expectRow('Lait, 2 L, dans le caddie');

    await device.terminateApp();
    await device.launchApp({ newInstance: true });

    await expectRow('Lait, 2 L, dans le caddie');
    await expect(element(by.label('Pain, pas dans le caddie'))).toBeVisible();
    await expect(element(by.text('1 article restant'))).toBeVisible();
  });
});
