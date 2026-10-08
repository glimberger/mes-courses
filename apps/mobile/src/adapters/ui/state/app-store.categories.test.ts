import type { CategoryId } from '../../../domain/category';
import { err, ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { buildStoryStore, type StoryScenario } from '../testing/story-store';
import type { AppStore } from './app-store';

/** A store on the shared fixture, which holds the 11 default categories. */
const buildStore = (scenario: StoryScenario = {}) =>
  buildStoryStore({ seed: fixture, ...scenario });

const shownCategories = (store: AppStore): string[] => {
  const region = store.getState().categories;
  if (region.status !== 'success') {
    throw new Error(`The categories are ${region.status}`);
  }
  return region.data.map((category) => category.name);
};

describe('createCategory', () => {
  it('US4-2 FR-019 returns the new category id and shows the category last in the picker', async () => {
    const { store } = await buildStore();
    await store.getState().loadCategories();

    const outcome = await store.getState().createCategory('Bébé');

    expect(outcome).toEqual(ok({ categoryId: 'id-1' as CategoryId }));
    expect(shownCategories(store)).toHaveLength(12);
    expect(shownCategories(store).at(-1)).toBe('Bébé');
  });

  it('US4-3 returns NameAlreadyUsed to the form, unreported', async () => {
    const { store, errorReporter } = await buildStore();

    const outcome = await store.getState().createCategory('boissons');

    expect(outcome).toEqual(
      err({
        type: 'NameAlreadyUsed',
        existing: expect.objectContaining({ name: 'Boissons' }),
      }),
    );
    expect(store.getState().notice).toBeNull();
    expect(errorReporter.reports).toEqual([]);
  });

  it('US4-4 returns NameRequired to the form, unreported', async () => {
    const { store, errorReporter } = await buildStore();

    expect(await store.getState().createCategory('  ')).toEqual(
      err({ type: 'NameRequired' }),
    );
    expect(errorReporter.reports).toEqual([]);
  });

  it('resolves to WriteFailed with the failed save notice when the save throws', async () => {
    const { store, errorReporter } = await buildStore({
      failing: ['createCategory'],
    });

    expect(await store.getState().createCategory('Bébé')).toEqual(
      err({ type: 'WriteFailed' }),
    );
    expect(store.getState().notice).toEqual({ type: 'writeFailed' });
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'createCategory' } },
    ]);
  });
});
