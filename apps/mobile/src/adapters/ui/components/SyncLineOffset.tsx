import { createContext, useContext, type ReactNode } from 'react';

/** Height of the sync status line (dp) while it is shown. */
export const SYNC_LINE_HEIGHT = 36;

const SyncLineOffsetContext = createContext(0);

/** Provides the line's current height: SYNC_LINE_HEIGHT when shown, 0 otherwise. */
export const SyncLineOffsetProvider = ({
  value,
  children,
}: {
  value: number;
  children: ReactNode;
}) => (
  <SyncLineOffsetContext.Provider value={value}>
    {children}
  </SyncLineOffsetContext.Provider>
);

/** The height the sync status line takes above the tab bar (0 when hidden). */
export const useSyncLineHeight = (): number =>
  useContext(SyncLineOffsetContext);
