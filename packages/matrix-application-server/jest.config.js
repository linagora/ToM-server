import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  clearMocks: true,
  restoreMocks: true
}
