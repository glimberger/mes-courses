/**
 * Whether the screen has another one below it in its own stack. Unlike `canGoBack()`, it does
 * not ask the tab navigator: the root of a tab has nothing to go back to, even though Android's
 * back button there returns to the Courses tab.
 */
export const hasScreenBelow = (navigation: {
  getState: () => { index: number } | undefined;
}): boolean => (navigation.getState()?.index ?? 0) > 0;
