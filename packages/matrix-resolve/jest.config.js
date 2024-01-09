import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  moduleNameMapper: {
    "node-fetch": "<rootDir>/../../node_modules/node-fetch-jest"
  }
}
