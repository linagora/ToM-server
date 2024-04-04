import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: true
}
