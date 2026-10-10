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
      setupFiles: ['<rootDir>/jest.setup.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/build-config/',
        '<rootDir>/src/adapters/sqlite/',
        '<rootDir>/src/composition/',
        '<rootDir>/src/traceability.test.ts',
        '<rootDir>/test/',
      ],
    },
    {
      // Tests that run in plain Node (no React Native runtime): build-time configuration, the
      // SQLite adapter and the composition root on `node:sqlite`, which the React Native
      // preset's globals break, and the traceability test, which reads files.
      displayName: 'node',
      preset: 'jest-expo/node',
      // jest-expo 58 adds the `expo-source` condition, whose `src/` entries the published Expo
      // packages (@expo/config among them) do not ship: resolve their built files instead.
      testEnvironmentOptions: { customExportConditions: ['node', 'require'] },
      testMatch: [
        '<rootDir>/build-config/**/*.test.ts',
        '<rootDir>/src/adapters/sqlite/**/*.test.ts',
        '<rootDir>/src/composition/**/*.test.ts',
        '<rootDir>/test/**/*.test.ts',
        '<rootDir>/src/traceability.test.ts',
      ],
    },
  ],
};
