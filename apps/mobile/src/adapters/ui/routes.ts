/** The app's routes, by name; none takes a parameter yet (contracts/ui-screens.md#navigation). */
export type RootStackParamList = {
  CurrentList: undefined;
  Lists: undefined;
  AddArticles: undefined;
  CreateArticle: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // An interface, so it merges with React Navigation's declaration.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
