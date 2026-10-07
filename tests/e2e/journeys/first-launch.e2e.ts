import { by, device, element, expect } from 'detox';

describe('first launch', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US3-1 US1-10 opens on the empty "Ma liste", offering to add articles', async () => {
    await expect(element(by.text('Ma liste'))).toBeVisible();
    await expect(element(by.text('Votre liste est vide'))).toBeVisible();
    await expect(element(by.text('Ajouter des articles'))).toBeVisible();
  });
});
