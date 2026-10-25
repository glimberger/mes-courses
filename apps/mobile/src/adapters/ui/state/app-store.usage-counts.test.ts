import type { ArticleId } from '../../../domain/article';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';

const lait = 'article-lait' as ArticleId;
const beurre = 'article-beurre' as ArticleId;

describe('the usage counts region', () => {
  it('loadArticleUsageCounts() shows the number of lists holding each article', async () => {
    const { store } = await buildStoryStore({ seed: fixture });

    await store.getState().loadArticleUsageCounts();

    const region = store.getState().usageCounts;
    if (region.status !== 'success') throw new Error(region.status);
    expect(region.data.get(lait)).toBe(1);
    expect(region.data.get(beurre)).toBeUndefined();
  });

  it('loadArticleUsageCounts() shows loading until the counts are read', async () => {
    const { store } = await buildStoryStore({
      seed: fixture,
      pending: ['getArticleUsageCounts'],
    });

    void store.getState().loadArticleUsageCounts();

    expect(store.getState().usageCounts).toEqual({ status: 'loading' });
  });

  it('loadArticleUsageCounts() shows the error and reports getArticleUsageCounts', async () => {
    const { store, errorReporter } = await buildStoryStore({
      seed: fixture,
      failing: ['getArticleUsageCounts'],
    });

    await store.getState().loadArticleUsageCounts();

    expect(store.getState().usageCounts.status).toBe('error');
    expect(errorReporter.reports[0]?.context.operation).toBe(
      'getArticleUsageCounts',
    );
  });
});
