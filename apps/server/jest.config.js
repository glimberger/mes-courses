/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: { '\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
