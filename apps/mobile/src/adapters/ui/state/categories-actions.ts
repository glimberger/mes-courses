import type { Category, CategoryId } from '../../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import type { Result } from '../../../domain/result';
import type { StoreKit, WriteFailed } from './store-kit';

/** The actions of the categories (User Story 4). */
export type CategoriesActions = {
  /** Creates a category after the existing ones; the refresh shows it in the picker (US4-2). */
  createCategory: (
    name: string,
  ) => Promise<
    Result<
      { categoryId: CategoryId },
      NameError | NameAlreadyUsed<Category> | WriteFailed
    >
  >;
};

export const createCategoriesActions = ({
  useCases,
  runWrite,
}: StoreKit): CategoriesActions => ({
  createCategory: (name) =>
    runWrite('createCategory', () => useCases.createCategory(name)),
});
