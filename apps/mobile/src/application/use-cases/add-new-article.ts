import type { Article, ArticleId } from '../../domain/article';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type { IdGenerator } from '../ports/id-generator';
import type { Repositories } from '../ports/unit-of-work';
import { uniqueName } from './unique-name';

/**
 * Inside a unit of work: creates the article with its name cleaned (FR-022) and records the
 * change, unless the name is already in the catalog (FR-021) or the category is unknown. The
 * rule shared by the creation of an article alone and of an article put on a list.
 */
export const addNewArticle = async (
  repos: Repositories,
  ids: IdGenerator,
  { name, categoryId }: { name: string; categoryId: CategoryId },
): Promise<
  Result<
    { articleId: ArticleId },
    NameError | NameAlreadyUsed<Article> | CategoryNotFound
  >
> => {
  const unique = await uniqueName(repos.articles, name);
  if (!unique.ok) return unique;
  if (!(await repos.categories.findById(categoryId))) {
    return err({ type: 'CategoryNotFound' });
  }

  const articleId = ids.next() as ArticleId;
  await repos.articles.add({ id: articleId, name: unique.value, categoryId });
  await repos.changes.record('article', articleId, {
    name: unique.value,
    categoryId,
  });
  return ok({ articleId });
};
