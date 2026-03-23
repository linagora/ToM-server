import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  // Override coverage thresholds for this package
  // The CLI entry point and some error paths are not easily unit-testable
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 20,
      lines: 65,
      statements: 65
    }
  },
  // Setup manual mocks
  modulePathIgnorePatterns: ['<rootDir>/dist/']
}
