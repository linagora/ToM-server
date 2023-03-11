export default {
  forceExit: true,
  testTimeout: 100000,
  testEnvironment: 'node',
  preset: 'ts-jest',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 50,
      lines: 90,
      statements: 90
    }
  }
}
