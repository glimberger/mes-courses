import { createContext, useContext, type ReactNode } from 'react';

import type { AppStore } from './app-store';

const AppStoreContext = createContext<AppStore | null>(null);

/** Gives the screens below it the app's store (002 contracts/ui-state.md). */
export const AppStoreProvider = ({
  store,
  children,
}: {
  store: AppStore;
  children: ReactNode;
}) => (
  <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
);

/** The store given by the nearest `AppStoreProvider`. */
export const useAppStoreApi = (): AppStore => {
  const store = useContext(AppStoreContext);
  if (store === null) {
    throw new Error('useAppStore must be used inside an AppStoreProvider');
  }
  return store;
};
