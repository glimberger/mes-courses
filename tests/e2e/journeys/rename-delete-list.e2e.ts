import { by, device, element, expect, waitFor } from 'detox';

import {
  chooseListMenuEntry,
  createList,
  expectListGone,
  expectRow,
  openLists,
  typeInto,
} from '../support/app';

describe('rename and delete a list', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('US1 renames "Barbecue" to "Barbecue dimanche", refusing a name already used', async () => {
    await openLists();
    await createList('Barbecue');
    await expectRow('Barbecue, 0 articles');

    // Cancelling leaves the name alone.
    await chooseListMenuEntry('Barbecue', 'Modifier');
    await typeInto('Nom', 'Autre nom');
    await element(by.label('Annuler')).tap();
    await expectRow('Barbecue, 0 articles');

    // A name another list bears is refused, and the dialog stays open.
    await chooseListMenuEntry('Barbecue', 'Modifier');
    await typeInto('Nom', 'Ma liste');
    await element(by.label('Enregistrer')).tap();
    await expect(
      element(by.text('Une liste porte déjà ce nom.')),
    ).toBeVisible();

    await typeInto('Nom', 'Barbecue dimanche');
    await element(by.label('Enregistrer')).tap();
    await expectRow('Barbecue dimanche, 0 articles');
    await expectListGone('Barbecue, 0 articles');
  });

  it('US2 deletes "Barbecue dimanche", cancelling once then confirming', async () => {
    await chooseListMenuEntry('Barbecue dimanche', 'Supprimer');
    await expect(
      element(by.text('Supprimer « Barbecue dimanche » ?')),
    ).toBeVisible();
    await element(by.label('Annuler')).tap();
    await expectRow('Barbecue dimanche, 0 articles');

    await chooseListMenuEntry('Barbecue dimanche', 'Supprimer');
    await element(by.label('Supprimer')).tap();
    await expectListGone('Barbecue dimanche, 0 articles');
  });

  it('US2 deleting the current "Ma liste" makes another list current', async () => {
    await createList('Barbecue dimanche');
    await expectRow('Barbecue dimanche, 0 articles');

    await chooseListMenuEntry('Ma liste', 'Supprimer');
    await element(by.label('Supprimer')).tap();
    await expectListGone('Ma liste, 0 articles, liste en cours');
    await expectRow('Barbecue dimanche, 0 articles, liste en cours');
  });

  it('US2 deleting the last list leaves a new empty "Ma liste", current', async () => {
    await chooseListMenuEntry('Barbecue dimanche', 'Supprimer');
    await element(by.label('Supprimer')).tap();
    await expectListGone('Barbecue dimanche, 0 articles, liste en cours');

    await waitFor(element(by.label('Ma liste, 0 articles, liste en cours')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
