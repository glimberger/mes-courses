import { by, device, element, expect, waitFor } from 'detox';

import {
  backToList,
  createArticle,
  expectRow,
  openAddArticles,
  openTab,
  typeInto,
} from '../support/app';

describe('signing in to a server that cannot be reached', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US4-1 shows no sync line and no sync banner on a fresh install', async () => {
    await expect(element(by.text('Ma liste'))).toBeVisible();

    await expect(element(by.id('sync-status-line'))).not.toExist();
    await expect(element(by.id('sync-status-bar'))).not.toExist();
    await expect(element(by.text('Synchronisé'))).not.toExist();
    await expect(element(by.text('Synchronisation…'))).not.toExist();
    await expect(
      element(by.text(/^En attente de synchronisation/)),
    ).not.toExist();
  });

  it('US4-1 the "Réglages" tab explains synchronization and offers "Se connecter"', async () => {
    await openTab('Réglages');

    await expect(
      element(
        by.text(
          'Connectez-vous pour retrouver vos listes sur vos autres appareils.',
        ),
      ),
    ).toBeVisible();
    await expect(element(by.label('Se connecter'))).toBeVisible();
  });

  it('US4-6 says the server cannot be reached when nothing listens at the address', async () => {
    await element(by.label('Se connecter')).tap();

    // The build's fixed address is port 9 of the device (.detoxrc.js): nothing listens there, and
    // no DNS query leaves it. There is no address to type (013).
    await typeInto('Adresse e-mail', 'marie@example.org');
    await typeInto('Mot de passe', 'any password');
    await element(by.label('Se connecter')).tap();

    await waitFor(
      element(
        by.text(
          "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.",
        ),
      ),
    )
      .toBeVisible()
      .withTimeout(15000);
  });

  it('FR-002 the current list still works at once: add and tick an item', async () => {
    if (device.getPlatform() === 'ios') {
      // iOS offers to save the password just typed, in a system sheet no test can reach: a
      // restart ends it, and the data of the device is kept.
      await device.launchApp({ newInstance: true });
    } else {
      // Back to the Courses tab of the bottom bar, which still shows the current list.
      await openTab('Courses');
    }
    await openAddArticles(true);
    await createArticle('Lait', 'Crèmerie');
    await backToList();

    await expectRow('Lait, pas dans le caddie');
    await element(by.label('Lait, pas dans le caddie')).tap();

    await expectRow('Lait, dans le caddie');
  });

  it('FR-020 shows no sync line and no banner on any tab while the status is only "waiting"', async () => {
    // The unreachable server leaves the status "waiting", which is not a problem state: the line
    // only shows the problems, and the banner is on Réglages alone.
    for (const tab of ['Courses', 'Listes', 'Articles', 'Réglages'] as const) {
      await openTab(tab);
      await expect(element(by.id('sync-status-line'))).not.toExist();
    }
    for (const tab of ['Courses', 'Listes', 'Articles'] as const) {
      await openTab(tab);
      await expect(element(by.id('sync-status-bar'))).not.toExist();
    }
  });
});
