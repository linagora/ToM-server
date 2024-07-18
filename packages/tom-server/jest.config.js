import jestConfigBase from '../../jest-base.config.js'

export default {
  ...jestConfigBase,
  testTimeout: 420000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    ...jestConfigBase.moduleNameMapper,
    'node-fetch': '<rootDir>/../../node_modules/node-fetch-jest'
  },
  clearMocks: true
}
