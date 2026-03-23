export default {
  testTimeout: 10000,
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/{!(pg|redis),}.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 50,
      lines: 80,
      statements: 80
    }
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig-test.json'
      },
    ]
  },
  moduleNameMapper: {
    "@twake/(.*)$": "<rootDir>/../$1/src",
    'matrix-resolve': '<rootDir>/../matrix-resolve/src'
  }
}
