/**
 * The package is "type": "module" and src/ is native ESM, so jest needs
 * --experimental-vm-modules (set in the npm "test" script) and an empty
 * transform so it does not try to run the sources through babel.
 */
export default {
  testEnvironment: 'node',
  transform: {},
  // globalSetup redirects HOME before workers fork; setupFiles re-checks it per
  // test file. Without this the suite reads and writes the real ~/.logloop.
  globalSetup: '<rootDir>/tests/jest.globalSetup.mjs',
  setupFiles: ['<rootDir>/tests/jest.setup.mjs'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // dashboard/ is a separate NestJS app with its own TypeScript test setup.
  testPathIgnorePatterns: ['/node_modules/', '/dashboard/'],
  collectCoverageFrom: ['src/**/*.js', 'bin/**/*.js'],
};
