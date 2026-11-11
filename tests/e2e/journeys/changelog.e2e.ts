import { by, device, element, expect, waitFor } from 'detox';

import { openTab } from '../support/app';

describe('Nouveautés', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('opens from the version row of Settings, and back returns to Settings', async () => {
    await openTab('Réglages');
    // The version row is the last of Settings: it may sit below the fold. The row and the text inside
    // it match, so the first one is tapped. Detox matches a regex against the whole label (Android),
    // so it ends with `.*`: "Version 2.1.0 (build 12)" is more than the prefix.
    const versionRow = element(by.label(/^Version .*/)).atIndex(0);
    await waitFor(versionRow)
      .toBeVisible()
      .whileElement(by.label('Contenu des réglages'))
      .scroll(300, 'down');
    await versionRow.tap();

    // The title, and the section of each release, read "Nouveautés": the first is the title.
    await expect(element(by.text('Nouveautés')).atIndex(0)).toBeVisible();

    await element(by.label('Retour')).tap();
    await expect(element(by.text('À propos'))).toBeVisible();
  });
});
