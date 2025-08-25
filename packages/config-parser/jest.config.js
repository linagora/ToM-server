import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  collectCoverageFrom: [
    './src/**/{!(pg|redis),}.ts',
    '!./src/utils.ts',   // exclude utils file for legacy code coverage
  ],
}