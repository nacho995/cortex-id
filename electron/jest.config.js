/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/preload'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.spec.ts',
    '**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Override for tests — relax some strict settings
          strict: true,
          esModuleInterop: true,
          resolveJsonModule: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    // Map workspace package to its built dist
    '^@cortex-id/shared-types$': '<rootDir>/../shared-types/dist/index.js',
    // Mock Electron in tests
    '^electron$': '<rootDir>/src/__mocks__/electron.ts',
    // Mock native modules
    '^node-pty$': '<rootDir>/src/__mocks__/node-pty.ts',
    '^keytar$': '<rootDir>/src/__mocks__/keytar.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'preload/**/*.ts',
    '!src/**/__mocks__/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Ignore compiled output
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Verbose output for CI
  verbose: true,
};
