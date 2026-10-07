// Global mocks of the app's Jest project. UI tests never reach a native SDK: Sentry records
// nothing, and expo-sqlite, which does not load in Jest, fails any use, so a UI test that
// reaches storage fails instead of passing on a database it does not have.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  captureException: jest.fn(),
  nativeCrash: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () =>
    Promise.reject(new Error('expo-sqlite is not loaded in UI tests')),
}));
