import { createContext, useContext } from 'react';

import type { ChangelogRelease } from '../../application/ports/changelog';

const NO_RELEASES: readonly ChangelogRelease[] = [];

const ChangelogContext =
  createContext<readonly ChangelogRelease[]>(NO_RELEASES);

/** Gives the screens the released changes, newest first. */
export const ChangelogProvider = ChangelogContext.Provider;

/** The released changes; none without a provider. */
export const useChangelog = () => useContext(ChangelogContext);
