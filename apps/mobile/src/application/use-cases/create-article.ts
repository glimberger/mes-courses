import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import type { Result } from '../../domain/result';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';
import { addNewArticle } from './add-new-article';

/**
 * Creates the article in the catalog only, its name cleaned (FR-022), and puts it on no list:
 * tidying the catalog must not change the shopping list. A name already in the catalog creates
 * nothing and returns that article (FR-021).
 */
export const createCreateArticle =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (article: {
    name: string;
    categoryId: CategoryId;
  }): Promise<
    Result<
      { articleId: ArticleId },
      NameError | NameAlreadyUsed<Article> | CategoryNotFound
    >
  > =>
    unitOfWork.run((repos) => addNewArticle(repos, ids, article));
