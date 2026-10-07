import type { CategoryId } from '../../domain/category';

/** The app's routes, by name, with their parameters (contracts/ui-screens.md#navigation). */
export type RootStackParamList = {
  CurrentList: undefined;
  Lists: undefined;
  AddArticles: undefined;
  /** The name to start from, and the category to choose, if any (FR-008, FR-018). */
  CreateArticle: { name?: string; categoryId?: CategoryId } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // An interface, so it merges with React Navigation's declaration.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
