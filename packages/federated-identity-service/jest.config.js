import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  testTimeout: 360000,
  moduleNameMapper: {
    ...jestConfigBase.moduleNameMapper,
    "node-fetch": "<rootDir>/../../node_modules/node-fetch-jest",
  },
  clearMocks: true
}
