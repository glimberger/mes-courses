import type {
  Article,
  ArticleId,
  ArticleNotFound,
} from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import { ok, type Result } from '../../../domain/result';
import type { StoreKit, WriteFailed } from './store-kit';

/** The actions that manage the catalog's articles (002). */
export type ArticlesActions = {
  /** Loads the number of lists holding each article, in one read; also used by "Réessayer". */
  loadArticleUsageCounts: () => Promise<void>;
  /** Renames the article and saves its category; every loaded region then shows it (US1-1, US1-2). */
  editArticle: (
    articleId: ArticleId,
    article: { name: string; categoryId: CategoryId },
  ) => Promise<
    Result<void, NameError | NameAlreadyUsed<Article> | WriteFailed>
  >;
  /** Deletes the article everywhere and offers to undo it (US2-1, US2-4, FR-010). */
  deleteArticle: (
    articleId: ArticleId,
  ) => Promise<Result<void, ArticleNotFound | WriteFailed>>;
};

export const createArticlesActions = ({
  useCases,
  runWrite,
  report,
  set,
  follow,
  region,
}: StoreKit): ArticlesActions => ({
  loadArticleUsageCounts: region(
    'usageCounts',
    'getArticleUsageCounts',
    async () => ({
      status: 'success',
      data: await useCases.getArticleUsageCounts(),
    }),
  ),
  editArticle: (articleId, article) =>
    runWrite('editArticle', () =>
      useCases.editArticle(follow(articleId), article),
    ),
  deleteArticle: async (articleId) => {
    const outcome = await runWrite(
      'deleteArticle',
      () => useCases.deleteArticle(follow(articleId)),
      {
        expected: ['ArticleNotFound'],
        offer: (deleted) => ({ kind: 'deletedArticle', deleted }),
      },
    );
    return outcome.ok ? ok(undefined) : outcome;
  },
});
