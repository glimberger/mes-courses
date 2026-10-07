/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/build-config/'],
    },
    {
      // Tests that run in plain Node (no React Native runtime): build-time configuration.
      displayName: 'node',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/build-config/**/*.test.ts'],
    },
  ],
};
