import { act } from '@testing-library/react-native';

/**
 * Paper's `Menu` runs a 250 ms hide animation when it mounts closed, and its end hides the items
 * even if the menu was opened meanwhile, which a loaded CI machine makes likely. Waiting past it
 * first makes opening the menu reliable.
 */
export const waitForMenusToSettle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 300)));
