export default {
  testTimeout: 30000,
  testEnvironment: 'node',
  preset: 'ts-jest',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/{!(pg|redis),}.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 50,
      lines: 90,
      statements: 90
    }
  },
  moduleNameMapper: {
    '@twake/(.*)$': '<rootDir>/../$1/src',
    'matrix-resolve': '<rootDir>/../matrix-resolve/src',
  }
}
