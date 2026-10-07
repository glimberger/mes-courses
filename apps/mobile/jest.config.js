const expoPreset = require('jest-expo/jest-preset');

// Storybook ships ES modules only: let Jest transform them like the Expo packages.
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map(
  (pattern) =>
    pattern.startsWith('/node_modules/(?!(')
      ? pattern.replace('(?!(', '(?!(storybook|@storybook|')
      : pattern,
);

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      transformIgnorePatterns,
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
