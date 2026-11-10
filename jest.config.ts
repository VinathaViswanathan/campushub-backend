import type { Config } from 'jest';

/**
 * Jest + ts-jest for the Express backend. Each test file gets its own in-memory
 * MongoDB (src/test/setup.ts), so files can run in parallel without sharing data.
 */
const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  // Coverage scope and gate required by Lab 7: src/services and src/controllers, >= 80%.
  // collectCoverageFrom limits the report to those folders, so "global" means exactly them.
  collectCoverageFrom: ['src/services/**/*.ts', 'src/controllers/**/*.ts'],
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: { statements: 80, branches: 80 },
  },

  // The first run downloads a MongoDB binary for mongodb-memory-server.
  testTimeout: 60_000,
};

export default config;
