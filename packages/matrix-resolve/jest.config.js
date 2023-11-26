export default {
  testTimeout: 120000,
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
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    "node-fetch": "<rootDir>/../../node_modules/node-fetch-jest"
  },
  clearMocks: true,
  globalTeardown: '<rootDir>/jest.global-teardown.ts'
}