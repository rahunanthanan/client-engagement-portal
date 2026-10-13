/**
 * Jest + React Testing Library + MSW (node interceptors).
 * `jest-fixed-jsdom` keeps Node's fetch/streams globals available inside jsdom so MSW 2 works.
 * `@swc/jest` transpiles TypeScript quickly; type checking is done separately by `pnpm typecheck`.
 * @type {import('jest').Config}
 */
export default {
  testEnvironment: 'jest-fixed-jsdom',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/src/test/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(t|j)sx?$|^.+\\.mjs$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  // MSW 2 depends on a few ESM-only packages; transpile those, leave the rest of node_modules alone.
  transformIgnorePatterns: ['/node_modules/(?!(.*\\.mjs$)|(\\.pnpm/)?(until-async|rettime)[@/])'],
  moduleNameMapper: {
    '^@/app/env$': '<rootDir>/src/test/env.jest.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/test/**',
    '!src/main.tsx',
    '!src/mocks/browser.ts',
    '!src/features/workflow/**/*Modeler*.tsx',
    '!src/features/workflow/**/*Viewer*.tsx',
    '!src/features/admin/FormJs*.tsx',
  ],
  coverageReporters: ['text-summary', 'lcov', 'cobertura'],
  reporters: ['default'],
};
