export default {
  testTimeout: 360000,
  testEnvironment: 'node',
  preset: 'ts-jest',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/{!(pg),}.ts'],
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
    "node-fetch": "<rootDir>/../../node_modules/node-fetch-jest",
    'matrix-resolve': '<rootDir>/../matrix-resolve/src'
  },
  clearMocks: true
}
