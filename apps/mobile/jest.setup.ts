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

// The key-value store is native too; UI tests that import it get an empty one.
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: () => null, setItemSync: () => undefined },
}));

// expo-asset 58.0.17 reads assets through `AssetRegistry` exported by `react-native`,
// while jest-expo only mocks the `react-native/asset-registry` entry point. Provide
// the same fake metadata so icon/image assets resolve in tests.
jest.mock('react-native/src/private/assets/AssetRegistry', () => ({
  AssetRegistry: {
    registerAsset: jest.fn(() => 1),
    getAssetByID: jest.fn(() => ({
      fileSystemLocation: '/full/path/to/directory',
      httpServerLocation: '/assets/full/path/to/directory',
      scales: [1],
      fileHashes: ['md5'],
      name: 'name',
      exists: true,
      type: 'type',
      hash: 'md5',
      uri: 'uri',
      width: 1,
      height: 1,
    })),
  },
}));
