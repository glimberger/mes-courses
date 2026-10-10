import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ServerRow } from '@mes-courses/sync-core';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { focusOn } from '../accessibility/focus';
import { fixture } from '../testing/fixtures';
import { recordFocusTargets } from '../testing/focus-targets';
import {
  OTHER_DEVICE_HLC,
  pullingSyncServer,
} from '../testing/pulling-sync-server';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { AddArticlesScreen } from './AddArticlesScreen';
import { CurrentListScreen } from './CurrentListScreen';
import { QuantityDialog, type QuantityRequest } from './QuantityDialog';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

let focusTargets: string[] = [];

beforeEach(() => {
  jest.mocked(focusOn).mockReset();
  focusTargets = recordFocusTargets(jest.mocked(focusOn));
});

const maListe = 'list-ma-liste' as ListId;
const beurre = { id: 'article-beurre' as ArticleId, name: 'Beurre' };
const lait = { id: 'article-lait' as ArticleId, name: 'Lait' };
const farine = { id: 'article-farine' as ArticleId, name: 'Farine' };

const notANumber =
  'La quantité doit être un nombre positif écrit en chiffres, par exemple 2 ou 1,5.';

/** The dialog as a screen holds it: open on `request` until it closes. */
const Host = ({ request }: { request: QuantityRequest }) => {
  const [open, setOpen] = useState(true);
  return (
    <QuantityDialog
      request={open ? request : null}
      onClose={() => setOpen(false)}
    />
  );
};

/** The dialog over the fixture's "Ma liste", shown next to it. */
const renderDialog = async (
  request: QuantityRequest,
  scenario: StoryScenario = {},
) => {
  const rendered = await renderWithStore(
    <>
      <CurrentListScreen />
      <Host request={request} />
    </>,
    { seed: fixture, ...scenario },
  );
  await screen.findByRole('checkbox', {
    name: 'Lait, 2 L, pas dans le caddie',
  });
  const stored = (articleId: ArticleId) =>
    rendered.unitOfWork.run((repos) => repos.items.find(maListe, articleId));
  return { ...rendered, stored };
};

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

/** Presses the dialog's button: drawn in a portal, it comes after the list's ("Ajouter"). */
const press = (name: string) => {
  const button = screen.getAllByRole('button', { name }).at(-1);
  if (!button) throw new Error(`No button "${name}"`);
  fireEvent.press(button);
};

/**
 * Whether the dialog titled so is open: its title is a header, inside the header that takes
 * screen reader focus.
 */
const isOpen = (title: string) =>
  screen.queryAllByRole('header', { name: title }).length > 0;

const closed = (title: string) =>
  waitFor(() => expect(isOpen(title)).toBe(false));

describe('QuantityDialog', () => {
  describe('add mode', () => {
    it('US2-1 SC-003 "Ajouter" with empty fields adds the article with no quantity', async () => {
      const { stored } = await renderDialog({ mode: 'add', article: beurre });
      expect(isOpen('Beurre')).toBe(true);

      press('Ajouter');

      await closed('Beurre');
      expect(await stored(beurre.id)).toEqual({
        listId: maListe,
        articleId: beurre.id,
        inCart: false,
        quantity: null,
      });
    });

    it('US2-2 FR-017 "1.5" and "kg" are shown as "1,5 kg" on the list', async () => {
      await renderDialog({ mode: 'add', article: beurre });

      type('Quantité', '1.5');
      type('Unité', 'kg');
      press('Ajouter');

      expect(
        await screen.findByRole('checkbox', {
          name: 'Beurre, 1,5 kg, pas dans le caddie',
        }),
      ).toBeOnTheScreen();
    });

    it('FR-017 "1,50" is shown as "1,5"', async () => {
      await renderDialog({ mode: 'add', article: beurre });

      type('Quantité', '1,50');
      press('Ajouter');

      expect(
        await screen.findByRole('checkbox', {
          name: 'Beurre, 1,5, pas dans le caddie',
        }),
      ).toBeOnTheScreen();
    });

    it.each([
      ['0', '', notANumber],
      ['-1', '', notANumber],
      ['abc', '', notANumber],
      ['1 000', '', notANumber],
      ['1,2345', '', 'La quantité ne peut pas avoir plus de 3 décimales.'],
      ['10000', '', 'La quantité ne peut pas dépasser 9999.'],
      ['', 'kg', 'Indiquez une quantité pour cette unité.'],
      ['1', 'u'.repeat(16), "L'unité ne peut pas dépasser 15 caractères."],
    ])(
      'US2-12 US2-13 FR-016 refuses "%s" "%s" with "%s", adding nothing and staying open',
      async (amount, unit, message) => {
        const { stored } = await renderDialog({ mode: 'add', article: beurre });

        type('Quantité', amount);
        type('Unité', unit);
        press('Ajouter');

        expect(await screen.findByText(message)).toBeOnTheScreen();
        expect(isOpen('Beurre')).toBe(true);
        expect(await stored(beurre.id)).toBeNull();
      },
    );

    it('US2-8 FR-011 turns to the already-on-list mode when the article is on the list', async () => {
      await renderDialog({ mode: 'add', article: lait });

      press('Ajouter');

      expect(
        await screen.findByText('« Lait » est déjà dans la liste.'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('Quantité')).toHaveDisplayValue('2');
      expect(screen.getByLabelText('Unité')).toHaveDisplayValue('L');
    });
  });

  describe('already-on-list mode', () => {
    const alreadyOnList: QuantityRequest = {
      mode: 'alreadyOnList',
      article: lait,
      quantity: { amount: 2, unit: 'L' },
    };

    it('US2-8 says the article is on the list, prefills its quantity, and offers "Fermer" and "Modifier la quantité"', async () => {
      await renderDialog(alreadyOnList);

      expect(
        screen.getByText('« Lait » est déjà dans la liste.'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('Quantité')).toHaveDisplayValue('2');
      expect(screen.getByLabelText('Unité')).toHaveDisplayValue('L');
      expect(screen.getByRole('button', { name: 'Fermer' })).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Modifier la quantité' }),
      ).toBeOnTheScreen();
      // Only the list's FAB.
      expect(screen.getAllByRole('button', { name: 'Ajouter' })).toHaveLength(
        1,
      );
    });

    it('US2-8 "Modifier la quantité" saves the new quantity, without adding the article twice', async () => {
      const { stored } = await renderDialog(alreadyOnList);

      type('Quantité', '3');
      press('Modifier la quantité');

      expect(
        await screen.findByRole('checkbox', {
          name: 'Lait, 3 L, pas dans le caddie',
        }),
      ).toBeOnTheScreen();
      expect(await stored(lait.id)).toMatchObject({
        quantity: { amount: 3, unit: 'L' },
      });
    });

    it('US2-8 "Fermer" changes nothing', async () => {
      const { stored } = await renderDialog(alreadyOnList);

      type('Quantité', '3');
      press('Fermer');

      await closed('Lait');
      expect(await stored(lait.id)).toMatchObject({
        quantity: { amount: 2, unit: 'L' },
      });
    });
  });

  describe('edit mode', () => {
    const editFarine: QuantityRequest = {
      mode: 'edit',
      article: farine,
      quantity: { amount: 1.5, unit: 'kg' },
    };

    it('FR-017 prefills "1,5" for 1.5, and saving it unchanged keeps 1.5', async () => {
      const { stored } = await renderDialog(editFarine);
      expect(screen.getByLabelText('Quantité')).toHaveDisplayValue('1,5');
      expect(screen.getByLabelText('Unité')).toHaveDisplayValue('kg');

      press('Enregistrer');

      await closed('Farine');
      expect(await stored(farine.id)).toMatchObject({
        quantity: { amount: 1.5, unit: 'kg' },
      });
    });

    it('US2-3 saves a new quantity', async () => {
      await renderDialog(editFarine);

      type('Quantité', '2');
      press('Enregistrer');

      expect(
        await screen.findByRole('checkbox', {
          name: 'Farine, 2 kg, pas dans le caddie',
        }),
      ).toBeOnTheScreen();
    });

    it('US2-4 "Effacer la quantité" clears the quantity', async () => {
      const { stored } = await renderDialog(editFarine);

      press('Effacer la quantité');

      expect(
        await screen.findByRole('checkbox', {
          name: 'Farine, pas dans le caddie',
        }),
      ).toBeOnTheScreen();
      expect((await stored(farine.id))?.quantity).toBeNull();
    });
  });

  describe('while saving', () => {
    /** The dialog's button: drawn in a portal, it comes after the list's ("Ajouter"). */
    const button = (name: string) =>
      screen.getAllByRole('button', { name }).at(-1);

    it('offers no "Annuler" and no "Ajouter" while the article is being added, so the outcome is always shown', async () => {
      await renderDialog(
        { mode: 'add', article: beurre },
        { pending: ['addArticleToList'] },
      );

      press('Ajouter');

      await waitFor(() => expect(button('Annuler')).toBeDisabled());
      expect(button('Ajouter')).toBeDisabled();
    });

    it('offers no "Annuler" while a quantity is being saved', async () => {
      await renderDialog(
        {
          mode: 'edit',
          article: farine,
          quantity: { amount: 1.5, unit: 'kg' },
        },
        { pending: ['changeItemQuantity'] },
      );

      press('Enregistrer');

      await waitFor(() => expect(button('Annuler')).toBeDisabled());
      expect(button('Effacer la quantité')).toBeDisabled();
    });

    it('adds the article once on a double tap of "Ajouter"', async () => {
      const { useCases } = await renderDialog({ mode: 'add', article: beurre });
      const addArticleToList = jest.spyOn(useCases, 'addArticleToList');

      press('Ajouter');
      press('Ajouter');

      await closed('Beurre');
      expect(addArticleToList).toHaveBeenCalledTimes(1);
    });
  });

  describe('FR-037 screen reader focus', () => {
    it('goes to the dialog title when it opens, and back to the row that opened it when it closes', async () => {
      await renderWithStore(<AddArticlesScreen />, { seed: fixture });

      fireEvent.press(await screen.findByRole('button', { name: 'Beurre' }));
      await waitFor(() => expect(isOpen('Beurre')).toBe(true));
      await waitFor(() => expect(focusTargets).toEqual(['Beurre']));

      press('Annuler');

      await closed('Beurre');
      await waitFor(() => expect(focusTargets).toEqual(['Beurre', 'Beurre']));
      // The row, a button, not the title of the closed dialog.
      const target = jest.mocked(focusOn).mock.calls.at(-1)?.[0].current as {
        props: { accessibilityRole?: string };
      } | null;
      expect(target?.props.accessibilityRole).toBe('button');
    });
  });

  describe('a pull while the dialog is open (FR-020a)', () => {
    const stamp = OTHER_DEVICE_HLC;

    /** A device connected to a fake server that sends `rows` once, at the next cycle. */
    const openEdit = async (request: QuantityRequest) => {
      const server = pullingSyncServer();
      const rendered = await renderDialog(request, {
        connected: {
          serverUrl: 'https://courses.example.fr',
          lastSyncAt: null,
        },
        syncServer: server.syncServer,
      });
      const pull = (sent: ServerRow[]) =>
        act(async () => {
          server.send(sent);
          await rendered.store.getState().syncNow();
        });
      return { ...rendered, pull };
    };

    const itemRow = (articleId: string, present: boolean): ServerRow => ({
      kind: 'listItem',
      id: `${maListe}:${articleId}`,
      seq: 1,
      fields: {
        listId: { value: maListe, hlc: stamp },
        articleId: { value: articleId, hlc: stamp },
        present: { value: present, hlc: stamp },
        inCart: { value: false, hlc: stamp },
        quantity: { value: { amount: 5, unit: 'L' }, hlc: stamp },
      },
      createdHlc: stamp,
      deletedHlc: null,
      mergedInto: null,
    });

    const deletedArticle = (id: string): ServerRow => ({
      kind: 'article',
      id,
      seq: 1,
      fields: {
        name: { value: 'Lait', hlc: stamp },
        categoryId: { value: 'category-0', hlc: stamp },
      },
      createdHlc: stamp,
      deletedHlc: stamp,
      mergedInto: null,
    });

    it('keeps what was typed when the pull changes the quantity, and saving records it', async () => {
      const { pull, stored } = await openEdit({
        mode: 'edit',
        article: lait,
        quantity: { amount: 2, unit: 'L' },
      });
      type('Quantité', '3');

      await pull([itemRow(lait.id, true)]);

      expect(screen.getByLabelText('Quantité')).toHaveDisplayValue('3');
      press('Enregistrer');
      await closed('Lait');
      expect(await stored(lait.id)).toMatchObject({
        quantity: { amount: 3, unit: 'L' },
      });
    });

    it('closes with "Cet article a été retiré de la liste sur un autre appareil." when the pull removes the item', async () => {
      const { pull, store } = await openEdit({
        mode: 'edit',
        article: lait,
        quantity: { amount: 2, unit: 'L' },
      });
      type('Quantité', '3');

      await pull([itemRow(lait.id, false)]);

      await closed('Lait');
      expect(store.getState().notice).toEqual({ type: 'itemRemovedElsewhere' });
    });

    it('closes with "Cet article a été supprimé sur un autre appareil." when the pull deletes the article', async () => {
      const { pull, store } = await openEdit({
        mode: 'edit',
        article: lait,
        quantity: { amount: 2, unit: 'L' },
      });

      await pull([deletedArticle(lait.id)]);

      await closed('Lait');
      expect(store.getState().notice).toEqual({
        type: 'articleDeletedElsewhere',
      });
    });

    it('stays open when the pull concerns another article', async () => {
      const { pull } = await openEdit({
        mode: 'edit',
        article: lait,
        quantity: { amount: 2, unit: 'L' },
      });

      await pull([itemRow(farine.id, false)]);

      expect(isOpen('Lait')).toBe(true);
    });

    it('FR-037 gives focus back to the row that opened the dialog when the pull closes it', async () => {
      const server = pullingSyncServer();
      const rendered = await renderWithStore(<AddArticlesScreen />, {
        seed: fixture,
        connected: {
          serverUrl: 'https://courses.example.fr',
          lastSyncAt: null,
        },
        syncServer: server.syncServer,
      });
      fireEvent.press(await screen.findByRole('button', { name: 'Beurre' }));
      await waitFor(() => expect(focusTargets).toEqual(['Beurre']));

      await act(async () => {
        server.send([deletedArticle(beurre.id)]);
        await rendered.store.getState().syncNow();
      });

      await closed('Beurre');
      // The row went with the article: focus leaves the closed dialog for the screen.
      await waitFor(() => expect(focusTargets).toHaveLength(2));
      expect(focusTargets[1]).not.toBe('Beurre');
    });
  });
});
