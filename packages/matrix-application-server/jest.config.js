export default {
  testTimeout: 10000,
  testEnvironment: 'node',
  preset: 'ts-jest',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 50,
      lines: 90,
      statements: 90
    }
  },
  moduleNameMapper: {
    "@twake/(.*)$": "<rootDir>/../$1/src",
  },
  clearMocks: true,
  restoreMocks: true,
  globalTeardown: '<rootDir>/jest.global-teardown.ts'
}
