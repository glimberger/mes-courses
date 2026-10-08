import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import type { UseCaseName } from '../use-cases';
import type { AppState } from './app-store';

const lait = 'article-lait' as ArticleId;
const barbecue = 'list-barbecue' as ListId;
const crèmerie = 'category-2' as CategoryId;

/** The names and quantities the actions below are given or read: none may reach a report. */
const content = [
  'Lait',
  'Beurre',
  'Houmous maison',
  'Ma liste',
  'Barbecue',
  'Pique-nique',
  'Bébé',
  'Crèmerie',
  '2 kg',
  'kg',
];

type Case = {
  /** The use case made to fail. */
  failing: UseCaseName;
  /** Runs the store action that calls it, the current list already loaded when it can be. */
  run: (state: AppState) => Promise<unknown>;
};

/** Every store action of US1 to US4 that reads or writes, each with its use case failing. */
const cases: Record<string, Case> = {
  'US1 loadCurrentList': {
    failing: 'getCurrentList',
    run: (state) => state.loadCurrentList(),
  },
  'US1 toggleItem': {
    failing: 'toggleItemInCart',
    run: (state) => state.toggleItem(lait),
  },
  'US1 finishShopping': {
    failing: 'finishShopping',
    run: (state) => state.finishShopping(),
  },
  'US2 loadCatalog': {
    failing: 'getCatalog',
    run: (state) => state.loadCatalog(),
  },
  'US2 loadCategories': {
    failing: 'getCategories',
    run: (state) => state.loadCategories(),
  },
  'US2 addArticleToList': {
    failing: 'addArticleToList',
    run: (state) =>
      state.addArticleToList(
        { id: 'article-beurre' as ArticleId, name: 'Beurre' },
        { amount: 2, unit: 'kg' },
      ),
  },
  'US2 createArticleAndAddToList': {
    failing: 'createArticleAndAddToList',
    run: (state) =>
      state.createArticleAndAddToList(
        { name: 'Houmous maison', categoryId: crèmerie },
        { amount: 2, unit: 'kg' },
      ),
  },
  'US2 changeItemQuantity': {
    failing: 'changeItemQuantity',
    run: (state) => state.changeItemQuantity(lait, { amount: 2, unit: 'kg' }),
  },
  'US2 removeItem': {
    failing: 'removeItemFromList',
    run: (state) => state.removeItem(lait),
  },
  'US2 undo': {
    failing: 'restoreRemovedItem',
    run: async (state) => {
      await state.removeItem(lait);
      await state.undo();
    },
  },
  'US3 loadLists': {
    failing: 'getLists',
    run: (state) => state.loadLists(),
  },
  'US3 createList': {
    failing: 'createList',
    run: (state) => state.createList('Pique-nique'),
  },
  'US3 setCurrentList': {
    failing: 'setCurrentList',
    run: (state) => state.setCurrentList(barbecue),
  },
  'US4 createCategory': {
    failing: 'createCategory',
    run: (state) => state.createCategory('Bébé'),
  },
};

describe('the context of every report the store makes', () => {
  it.each(Object.entries(cases))(
    'FR-030 %s reports with the operation and screen only, never a name or a quantity',
    async (_action, { failing, run }) => {
      const { store, errorReporter } = await buildStoryStore({
        seed: fixture,
        failing: [failing],
      });
      if (failing !== 'getCurrentList') {
        await store.getState().loadCurrentList();
      }

      await run(store.getState());

      expect(errorReporter.reports.length).toBeGreaterThan(0);
      for (const { context } of errorReporter.reports) {
        expect(
          Object.keys(context).every((key) =>
            ['operation', 'screen'].includes(key),
          ),
        ).toBe(true);
        expect(typeof context.operation).toBe('string');
        const serialized = JSON.stringify(context);
        for (const text of content) {
          expect(serialized).not.toContain(text);
        }
      }
    },
  );
});
