import { useStore } from 'zustand';

import type { AppState } from './app-store';
import { useAppStoreApi } from './app-store-provider';

/**
 * Selects a slice of the app's state. A component re-renders only when its slice changes, so
 * each one selects the smallest slice it renders.
 */
export const useAppStore = <T>(selector: (state: AppState) => T): T =>
  useStore(useAppStoreApi(), selector);
