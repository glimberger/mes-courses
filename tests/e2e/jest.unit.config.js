// The pure helpers of the screenshot tooling: plain Jest, no emulator.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/screenshots/**/*.test.ts'],
  transform: { '\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
