import type {
  Article,
  ArticleId,
  ArticleNotFound,
  ArticleUsage,
} from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import { err, ok, type Result } from '../../../domain/result';
import type { StoreKit, WriteFailed } from './store-kit';

/** The actions that manage the catalog's articles (002). */
export type ArticlesActions = {
  /** Renames the article and saves its category; every loaded region then shows it (US1-1, US1-2). */
  editArticle: (
    articleId: ArticleId,
    article: { name: string; categoryId: CategoryId },
  ) => Promise<
    Result<void, NameError | NameAlreadyUsed<Article> | WriteFailed>
  >;
  /** Reads where the article is used, for the delete dialog; stores nothing (US2-3). */
  getArticleUsage: (
    articleId: ArticleId,
  ) => Promise<Result<ArticleUsage, ArticleNotFound | WriteFailed>>;
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
}: StoreKit): ArticlesActions => ({
  editArticle: (articleId, article) =>
    runWrite('editArticle', () => useCases.editArticle(articleId, article)),
  getArticleUsage: async (articleId) => {
    try {
      return await useCases.getArticleUsage(articleId);
    } catch (error) {
      // Only the add screen opens the delete dialog.
      report(error, 'getArticleUsage', 'AddArticles');
      set({ notice: { type: 'writeFailed' } });
      return err({ type: 'WriteFailed' });
    }
  },
  deleteArticle: async (articleId) => {
    const outcome = await runWrite(
      'deleteArticle',
      () => useCases.deleteArticle(articleId),
      {
        expected: ['ArticleNotFound'],
        offer: (deleted) => ({ kind: 'deletedArticle', deleted }),
      },
    );
    return outcome.ok ? ok(undefined) : outcome;
  },
});
