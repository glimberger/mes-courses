import type { ArticleId } from '../../../domain/article';
import type { ListSummary } from '../../../domain/list-summary';
import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { buildStoryStore, type StoryScenario } from '../testing/story-store';
import type { AppStore } from './app-store';
import { shownList } from './current-list-actions';
import { UnexpectedResult } from './unexpected-result';

const maListe = 'list-ma-liste' as ListId;
const barbecue = 'list-barbecue' as ListId;
const lait = 'article-lait' as ArticleId;

/** A store on the shared fixture: "Ma liste" (current, 4 items) and an empty "Barbecue". */
const buildStore = (scenario: StoryScenario = {}) =>
  buildStoryStore({ seed: fixture, ...scenario });

const shownLists = (store: AppStore): ListSummary[] => {
  const region = store.getState().lists;
  if (region.status !== 'success') {
    throw new Error(`The lists are ${region.status}`);
  }
  return region.data;
};

describe('the lists region', () => {
  it('US3-8 loadLists() shows every list by name, with its item count and current mark', async () => {
    const { store } = await buildStore();

    await store.getState().loadLists();

    expect(shownLists(store)).toEqual([
      { id: barbecue, name: 'Barbecue', itemCount: 0, isCurrent: false },
      { id: maListe, name: 'Ma liste', itemCount: 4, isCurrent: true },
    ]);
  });

  it('US3-7 loadLists() shows loading until the lists are read', async () => {
    const { store } = await buildStore({ pending: ['getLists'] });

    void store.getState().loadLists();

    expect(store.getState().lists).toEqual({ status: 'loading' });
  });

  it('US3-7 loadLists() shows the error and reports it with the operation getLists', async () => {
    const { store, errorReporter } = await buildStore({
      failing: ['getLists'],
    });

    await store.getState().loadLists();

    expect(store.getState().lists).toEqual({
      status: 'error',
      error: expect.any(Error),
    });
    // The app's reporter adds the screen shown, Lists (contracts/driven-ports.md).
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'getLists' } },
    ]);
  });
});

describe('createList', () => {
  it('US3-2 FR-024 returns the new list id and shows it in the lists, not current', async () => {
    const { store } = await buildStore();
    await store.getState().loadLists();

    const outcome = await store.getState().createList('Week-end');

    expect(outcome).toEqual(ok({ listId: 'id-1' }));
    expect(
      shownLists(store).map(({ name, isCurrent }) => [name, isCurrent]),
    ).toEqual([
      ['Barbecue', false],
      ['Ma liste', true],
      ['Week-end', false],
    ]);
  });

  it('US3-5 returns NameAlreadyUsed to the form, unreported, keeping the undo offer', async () => {
    const { store, errorReporter } = await buildStore();
    await store.getState().loadCurrentList();
    await store.getState().removeItem(lait);

    const outcome = await store.getState().createList('barbecue');

    expect(outcome).toEqual(
      err({
        type: 'NameAlreadyUsed',
        existing: { id: barbecue, name: 'Barbecue' },
      }),
    );
    expect(store.getState().pendingUndo).not.toBeNull();
    expect(store.getState().notice).toBeNull();
    expect(errorReporter.reports).toEqual([]);
  });

  it('US3-6 returns NameRequired to the form, unreported', async () => {
    const { store, errorReporter } = await buildStore();

    expect(await store.getState().createList('  ')).toEqual(
      err({ type: 'NameRequired' }),
    );
    expect(errorReporter.reports).toEqual([]);
  });

  it('resolves to WriteFailed with the failed save notice when the save throws', async () => {
    const { store, errorReporter } = await buildStore({
      failing: ['createList'],
    });

    expect(await store.getState().createList('Week-end')).toEqual(
      err({ type: 'WriteFailed' }),
    );
    expect(store.getState().notice).toEqual({ type: 'writeFailed' });
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'createList' } },
    ]);
  });
});

describe('setCurrentList', () => {
  it('US3-3 refreshes, so the current list region shows the chosen list', async () => {
    const { store } = await buildStore();
    await store.getState().loadCurrentList();
    await store.getState().loadLists();

    const outcome = await store.getState().setCurrentList(barbecue);

    expect(outcome).toEqual(ok(undefined));
    expect(shownList(store.getState().currentList)).toEqual({
      id: barbecue,
      name: 'Barbecue',
    });
    expect(store.getState().currentList.status).toBe('empty');
    expect(shownLists(store).find((list) => list.isCurrent)?.name).toBe(
      'Barbecue',
    );
  });

  it('FR-010 changing the current list ends the undo offer', async () => {
    const { store } = await buildStore();
    await store.getState().loadCurrentList();
    await store.getState().removeItem(lait);

    await store.getState().setCurrentList(barbecue);

    expect(store.getState().pendingUndo).toBeNull();
  });

  it('FR-030 treats ListNotFound as a failed save, reported as UnexpectedResult', async () => {
    const { store, errorReporter } = await buildStore();

    const outcome = await store
      .getState()
      .setCurrentList('list-unknown' as ListId);

    expect(outcome).toEqual(err({ type: 'WriteFailed' }));
    expect(store.getState().notice).toEqual({ type: 'writeFailed' });
    expect(errorReporter.reports).toEqual([
      {
        error: expect.any(UnexpectedResult),
        context: { operation: 'setCurrentList' },
      },
    ]);
  });
});
