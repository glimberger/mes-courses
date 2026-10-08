import type { Article, ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import type { Result } from '../../../domain/result';
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
};

export const createArticlesActions = ({
  useCases,
  runWrite,
}: StoreKit): ArticlesActions => ({
  editArticle: (articleId, article) =>
    runWrite('editArticle', () => useCases.editArticle(articleId, article)),
});
