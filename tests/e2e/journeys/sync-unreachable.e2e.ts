import { by, device, element, expect, waitFor } from 'detox';

import {
  backToList,
  createArticle,
  expectRow,
  openAddArticles,
  typeInto,
} from '../support/app';

describe('connecting to a server that cannot be reached', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US4-1 shows no sync status bar on a fresh install', async () => {
    await expect(element(by.text('Ma liste'))).toBeVisible();

    await expect(element(by.text('Synchronisé'))).not.toExist();
    await expect(element(by.text('Synchronisation…'))).not.toExist();
    await expect(
      element(by.text(/^En attente de synchronisation/)),
    ).not.toExist();
  });

  it('US4-1 "Réglages" explains synchronization and offers "Connecter à un serveur"', async () => {
    await element(by.label('Réglages')).tap();

    await expect(
      element(
        by.text(
          'Synchronisez vos listes avec votre serveur pour les retrouver sur vos autres appareils.',
        ),
      ),
    ).toBeVisible();
    await expect(element(by.label('Connecter à un serveur'))).toBeVisible();
  });

  it('US4-6 says the server cannot be reached when nothing listens at the address', async () => {
    await element(by.label('Connecter à un serveur')).tap();

    // Nothing listens on port 9 of the device, and no DNS query leaves it.
    await typeInto('Adresse du serveur', '127.0.0.1:9');
    await typeInto("Code d'appairage", 'ABCD-EF23');
    await element(by.label('Connecter')).tap();

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
    await element(by.label('Retour')).tap();
    await element(by.label('Retour')).tap();
    await openAddArticles(true);
    await createArticle('Lait', 'Crèmerie');
    await backToList();

    await expectRow('Lait, pas dans le caddie');
    await element(by.label('Lait, pas dans le caddie')).tap();

    await expectRow('Lait, dans le caddie');
  });
});
