// SHOTS=1 (the e2e:shots:* scripts) runs the screenshots instead of the journeys.
const shots = process.env.SHOTS === '1';

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testMatch: shots
    ? ['<rootDir>/screenshots/**/*.shots.ts']
    : ['<rootDir>/journeys/**/*.e2e.ts'],
  transform: { '\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testTimeout: shots ? 900000 : 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
