import { createContext, useContext } from 'react';

import {
  UNKNOWN_APP_INFO,
  type AppInfo,
} from '../../application/ports/app-info';

const AppInfoContext = createContext<AppInfo>(UNKNOWN_APP_INFO);

/** Gives the screens the identity of the running build. */
export const AppInfoProvider = AppInfoContext.Provider;

/** The identity of the running build; the unknown one (`0.0.0`) without a provider. */
export const useAppInfo = () => useContext(AppInfoContext);
