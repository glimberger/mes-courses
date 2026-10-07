import { by, device, element, expect, waitFor } from 'detox';

import { expectAbove } from '../support/app';

/** The default categories, in the order of the spec's Assumptions (US4-1). */
const DEFAULT_CATEGORIES = [
  'Fruits et légumes',
  'Boucherie et poissonnerie',
  'Crèmerie',
  'Boulangerie',
  'Épicerie salée',
  'Épicerie sucrée',
  'Surgelés',
  'Boissons',
  'Hygiène et beauté',
  'Entretien',
  'Divers',
];

describe('first launch', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US3-1 US1-10 opens on the empty "Ma liste", offering to add articles', async () => {
    await expect(element(by.text('Ma liste'))).toBeVisible();
    await expect(element(by.text('Votre liste est vide'))).toBeVisible();
    await expect(element(by.text('Ajouter des articles'))).toBeVisible();
  });

  it('US4-1 "Ajouter des articles" shows the default categories in order', async () => {
    await element(by.label('Ajouter des articles')).tap();

    let previous: string | null = null;
    for (const category of DEFAULT_CATEGORIES) {
      // The list only scrolls down, so a category found below the one before it, or with the one
      // before already scrolled out of sight, comes after it.
      await waitFor(element(by.text(category)))
        .toBeVisible()
        .whileElement(by.label('Articles du catalogue'))
        .scroll(200, 'down');
      if (previous !== null) {
        await expectAbove(by.text(previous), by.text(category), {
          upperScrolledOff: true,
        });
      }
      previous = category;
    }
  });
});
