import { by, device, element, expect } from 'detox';

import {
  backToList,
  createArticle,
  expectRow,
  openAddArticles,
} from '../support/app';

describe('finish shopping', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
    await openAddArticles(true);
    await createArticle('Lait', 'Crèmerie', { amount: '2', unit: 'L' });
    await createArticle('Pain', 'Boulangerie');
    await createArticle('Pommes', 'Fruits et légumes');
    await backToList();
    await element(by.label('Lait, 2 L, pas dans le caddie')).tap();
    await element(by.label('Pain, pas dans le caddie')).tap();
    await expectRow('Pain, dans le caddie');
  });

  it('US1-9 "Annuler" changes nothing', async () => {
    await element(by.label('Terminer les courses')).tap();
    await expect(element(by.text('Terminer les courses ?'))).toBeVisible();

    await element(by.text('Annuler')).tap();

    await expect(element(by.text('Terminer les courses ?'))).not.toExist();
    await expect(element(by.label('Lait, 2 L, dans le caddie'))).toBeVisible();
    await expect(element(by.label('Pain, dans le caddie'))).toBeVisible();
    await expect(element(by.label('Pommes, pas dans le caddie'))).toBeVisible();
  });

  it('US1-8 "Terminer" unticks every item, keeping the items and their quantities', async () => {
    await element(by.label('Terminer les courses')).tap();

    await element(by.text('Terminer')).tap();

    await expectRow('Lait, 2 L, pas dans le caddie');
    await expect(element(by.label('Pain, pas dans le caddie'))).toBeVisible();
    await expect(element(by.label('Pommes, pas dans le caddie'))).toBeVisible();
    await expect(element(by.text('3 articles restants'))).toBeVisible();
    await expect(element(by.label('Terminer les courses'))).not.toExist();
  });
});
