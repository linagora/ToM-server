import twakeConfig, {
  ConfigDescription,
  FileReadParseError,
  UnacceptedKeyError,
  ConfigCoercionError,
  MissingRequiredConfigError,
  Configuration
} from './index'
import fs from 'fs'
import path from 'path'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}))

/**
 * Helper function to create a ConfigDescription object for tests.
 * @returns {ConfigDescription} A ConfigDescription object with various key types and defaults.
 */
const createTestConfigDesc = (): ConfigDescription => ({
  STRING_KEY: { type: 'string', default: 'defaultString' },
  NUMBER_KEY: { type: 'number', default: 100 },
  BOOLEAN_KEY: { type: 'boolean', default: true },
  ARRAY_KEY: { type: 'array', default: ['defaultArrayItem'] },
  JSON_KEY: { type: 'json', default: { default: 'json' } },
  OBJECT_KEY: { type: 'object', default: { defaultObject: 'value' } },
  NULL_KEY: { type: 'string', default: null },
  UNDEFINED_KEY: { type: 'string', default: undefined },
  NO_DEFAULT_KEY: { type: 'string' },
  REQUIRED_KEY: { type: 'string', default: 'defaultRequiredValue' }
})

/**
 * Helper to clear environment variables used in tests.
 */
const clearEnv = () => {
  const testDesc = createTestConfigDesc()
  Object.keys(testDesc).forEach((key) => {
    delete process.env[key.toUpperCase()]
  })
  delete process.env.TEST_ENV_STRING
  delete process.env.TEST_ENV_NUMBER
  delete process.env.TEST_ENV_BOOLEAN
  delete process.env.TEST_ENV_ARRAY
  delete process.env.TEST_ENV_JSON
  delete process.env.TEST_ENV_OBJECT
  delete process.env.UNWANTED_VALUE
  delete process.env.MY_REQUIRED_KEY
}

/**
 * Sets up mock file system behavior for tests.
 * @param {Object.<string, string>} files - An object where keys are file paths and values are their content.
 */
const setupMockFs = (files: { [key: string]: string }) => {
  ;(fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
    return Object.keys(files).some(
      (mockPath) => path.resolve(mockPath) === path.resolve(filePath)
    )
  })
  ;(fs.promises.readFile as jest.Mock).mockImplementation(
    async (filePath: string) => {
      const content = files[filePath]
      if (content === undefined) {
        const error = new Error(
          `ENOENT: no such file or directory, open '${filePath}'`
        )
        ;(error as any).code = 'ENOENT'
        throw error
      }
      return content
    }
  )
}

describe('twakeConfig - Basic Cases', () => {
  beforeEach(() => {
    clearEnv()
    ;(fs.promises.readFile as jest.Mock).mockClear()
    ;(fs.existsSync as jest.Mock).mockClear()
  })

  test('Should return default values when no file or env vars are provided', async () => {
    const res: Configuration = await twakeConfig(createTestConfigDesc())
    expect(res).toEqual({
      STRING_KEY: 'defaultString',
      NUMBER_KEY: 100,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      OBJECT_KEY: { defaultObject: 'value' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: 'defaultRequiredValue'
    })
  })

  test('Should load config from file and override defaults', async () => {
    const mockFilePath = 'config.json'
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'fileString',
        NUMBER_KEY: 200,
        OBJECT_KEY: { fileObject: 'newValue' }
      })
    })

    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      mockFilePath
    )
    expect(res).toEqual({
      STRING_KEY: 'fileString',
      NUMBER_KEY: 200,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      OBJECT_KEY: { fileObject: 'newValue' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: 'defaultRequiredValue'
    })
    expect(fs.promises.readFile).toHaveBeenCalledWith(mockFilePath, 'utf8')
  })

  test('Should load config from object and override defaults', async () => {
    const initialConfig: Configuration = {
      STRING_KEY: 'objectString',
      BOOLEAN_KEY: false,
      OBJECT_KEY: { objectOverride: 'test' }
    }
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      initialConfig
    )
    expect(res).toEqual({
      STRING_KEY: 'objectString',
      NUMBER_KEY: 100,
      BOOLEAN_KEY: false,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      OBJECT_KEY: { objectOverride: 'test' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: 'defaultRequiredValue'
    })
  })

  test('Should override defaults with environment variables when useEnv is true', async () => {
    process.env.STRING_KEY = 'envString'
    process.env.NUMBER_KEY = '300'
    process.env.BOOLEAN_KEY = 'false'
    process.env.OBJECT_KEY = '{"envObject": "envValue"}'

    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res).toEqual({
      STRING_KEY: 'envString',
      NUMBER_KEY: 300,
      BOOLEAN_KEY: false,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      OBJECT_KEY: { envObject: 'envValue' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: 'defaultRequiredValue'
    })
  })
})

describe('twakeConfig - Easy Cases (Mixed Sources)', () => {
  beforeEach(() => {
    clearEnv()
    ;(fs.promises.readFile as jest.Mock).mockClear()
    ;(fs.existsSync as jest.Mock).mockClear()
  })

  test('Environment variables should override file values', async () => {
    const mockFilePath = 'config.json'
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'fileString',
        NUMBER_KEY: 200,
        BOOLEAN_KEY: false,
        OBJECT_KEY: { fileObject: 'oldValue' }
      })
    })

    process.env.STRING_KEY = 'envOverrideString'
    process.env.NUMBER_KEY = '999'
    process.env.BOOLEAN_KEY = 'true'
    process.env.OBJECT_KEY = '{"envObject": "newValue"}'

    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      mockFilePath,
      true
    )
    expect(res).toEqual({
      STRING_KEY: 'envOverrideString',
      NUMBER_KEY: 999,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      OBJECT_KEY: { envObject: 'newValue' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: 'defaultRequiredValue'
    })
  })

  test('File values should override defaults when env vars are not used', async () => {
    const mockFilePath = 'config.json'
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'fileString',
        NUMBER_KEY: 200,
        BOOLEAN_KEY: false,
        OBJECT_KEY: { fileObject: 'fromFile' }
      })
    })

    process.env.STRING_KEY = 'thisShouldBeIgnored'

    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      mockFilePath,
      false
    )
    expect(res).toEqual({
      STRING_KEY: 'fileString',
      NUMBER_KEY: 200,
      BOOLEAN_KEY: false,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      OBJECT_KEY: { fileObject: 'fromFile' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: 'defaultRequiredValue'
    })
  })
})

describe('twakeConfig - Medium Cases (Coercion Details)', () => {
  beforeEach(() => {
    clearEnv()
    ;(fs.promises.readFile as jest.Mock).mockClear()
    ;(fs.existsSync as jest.Mock).mockClear()
  })

  test('Array type coercion from comma-separated string', async () => {
    process.env.ARRAY_KEY = 'item1,item2, item3 , item4'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.ARRAY_KEY).toEqual(['item1', 'item2', 'item3', 'item4'])
  })

  test('Array type coercion from space-separated string', async () => {
    process.env.ARRAY_KEY = 'itemA itemB  itemC'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.ARRAY_KEY).toEqual(['itemA', 'itemB', 'itemC'])
  })

  test('JSON type coercion from simple JSON string', async () => {
    process.env.JSON_KEY = '{"name": "test", "value": 123}'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.JSON_KEY).toEqual({ name: 'test', value: 123 })
  })

  test('Object type coercion from simple JSON string (environment variable)', async () => {
    process.env.OBJECT_KEY = '{"key": "value", "num": 456}'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.OBJECT_KEY).toEqual({ key: 'value', num: 456 })
  })

  test('Boolean coercion with "1" and "0"', async () => {
    process.env.BOOLEAN_KEY = '1'
    let res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.BOOLEAN_KEY).toBe(true)

    process.env.BOOLEAN_KEY = '0'
    res = await twakeConfig(createTestConfigDesc(), undefined, true)
    expect(res.BOOLEAN_KEY).toBe(false)
  })

  test('Boolean coercion with mixed case "TRUE" and "FALSE"', async () => {
    process.env.BOOLEAN_KEY = 'TRUE'
    let res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.BOOLEAN_KEY).toBe(true)

    process.env.BOOLEAN_KEY = 'fAlSe'
    res = await twakeConfig(createTestConfigDesc(), undefined, true)
    expect(res.BOOLEAN_KEY).toBe(false)
  })
})

describe('twakeConfig - Hard Cases (Complex Coercion & Defaults)', () => {
  beforeEach(() => {
    clearEnv()
    ;(fs.promises.readFile as jest.Mock).mockClear()
    ;(fs.existsSync as jest.Mock).mockClear()
  })

  test('JSON type coercion from complex JSON string', async () => {
    process.env.JSON_KEY =
      '{"data": [{"id": 1, "val": "a"}, {"id": 2, "val": "b"}], "meta": {"version": "1.0"}}'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.JSON_KEY).toEqual({
      data: [
        { id: 1, val: 'a' },
        { id: 2, val: 'b' }
      ],
      meta: { version: '1.0' }
    })
  })

  test('Object type coercion from complex JSON string (environment variable)', async () => {
    process.env.OBJECT_KEY =
      '{"complex": {"nested": true, "items": [1, 2, 3]}, "status": "active"}'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.OBJECT_KEY).toEqual({
      complex: { nested: true, items: [1, 2, 3] },
      status: 'active'
    })
  })

  test('Array coercion with empty string items', async () => {
    process.env.ARRAY_KEY = 'item1,,item2'
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.ARRAY_KEY).toEqual(['item1', 'item2'])

    process.env.ARRAY_KEY = ''
    const resEmpty: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(resEmpty.ARRAY_KEY).toEqual([])
  })

  test('Default value is a string but needs coercion to target type', async () => {
    const descWithCoercibleDefault: ConfigDescription = {
      NUM_FROM_STRING: { type: 'number', default: '42' },
      BOOL_FROM_STRING: { type: 'boolean', default: 'true' },
      OBJ_FROM_STRING: { type: 'object', default: '{"defaultObj": "fromStr"}' },
      ARRAY_FROM_STRING: { type: 'array', default: 'itemA,itemB' }
    }
    const res: Configuration = await twakeConfig(descWithCoercibleDefault)
    expect(res.NUM_FROM_STRING).toBe(42)
    expect(res.BOOL_FROM_STRING).toBe(true)
    expect(res.OBJ_FROM_STRING).toEqual({ defaultObj: 'fromStr' })
    expect(res.ARRAY_FROM_STRING).toEqual(['itemA', 'itemB'])
  })

  test('Default value is already correct type, no coercion needed', async () => {
    const descWithCorrectDefault: ConfigDescription = {
      NUM_FROM_NUMBER: { type: 'number', default: 42 },
      BOOL_FROM_BOOLEAN: { type: 'boolean', default: true },
      OBJ_FROM_OBJECT: { type: 'object', default: { defaultObj: 'fromObj' } }
    }
    const res: Configuration = await twakeConfig(descWithCorrectDefault)
    expect(res.NUM_FROM_NUMBER).toBe(42)
    expect(res.BOOL_FROM_BOOLEAN).toBe(true)
    expect(res.OBJ_FROM_OBJECT).toEqual({ defaultObj: 'fromObj' })
  })
})

describe('twakeConfig - Side Effects', () => {
  beforeEach(() => {
    clearEnv()
    ;(fs.promises.readFile as jest.Mock).mockClear()
    ;(fs.existsSync as jest.Mock).mockClear()
  })

  test('Should not modify the input ConfigDescription object', async () => {
    const originalDesc = createTestConfigDesc()
    const descCopy = JSON.parse(JSON.stringify(originalDesc))
    await twakeConfig(originalDesc)
    expect(originalDesc).toEqual(descCopy)
  })

  test('Should not modify the input defaultConfigurationFile object', async () => {
    const originalFileConfig: Configuration = {
      STRING_KEY: 'initial',
      NUMBER_KEY: 123,
      OBJECT_KEY: { some: 'value' }
    }
    const fileConfigCopy = JSON.parse(JSON.stringify(originalFileConfig))
    await twakeConfig(createTestConfigDesc(), originalFileConfig)
    expect(originalFileConfig).toEqual(fileConfigCopy)
  })
})

describe('twakeConfig - Edge Cases and Error Handling', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    clearEnv()
    ;(fs.promises.readFile as jest.Mock).mockClear()
    ;(fs.existsSync as jest.Mock).mockClear()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  test('Should fall back to default if environment variable is empty string', async () => {
    process.env.STRING_KEY = ''
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.STRING_KEY).toBe('defaultString')
  })

  test('Should fall back to default if environment variable is null/undefined (not set)', async () => {
    const res: Configuration = await twakeConfig(
      createTestConfigDesc(),
      undefined,
      true
    )
    expect(res.STRING_KEY).toBe('defaultString')
  })

  test('Should throw UnacceptedKeyError for unwanted key in defaultConfigurationFile object', async () => {
    const initialConfig: Configuration = {
      STRING_KEY: 'valid',
      UNWANTED_KEY_FROM_OBJECT: 'bad'
    }
    await expect(
      twakeConfig(createTestConfigDesc(), initialConfig)
    ).rejects.toThrow(UnacceptedKeyError)
    await expect(
      twakeConfig(createTestConfigDesc(), initialConfig)
    ).rejects.toThrow(
      "Configuration key 'UNWANTED_KEY_FROM_OBJECT' isn't accepted as it's not defined in the ConfigDescription."
    )
  })

  test('Should throw UnacceptedKeyError for unwanted key in defaultConfigurationFile (JSON file)', async () => {
    const mockFilePath = 'unwanted_key_file.json'
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'valid',
        unwanted_value: 'bad'
      })
    })
    await expect(
      twakeConfig(createTestConfigDesc(), mockFilePath)
    ).rejects.toThrow(UnacceptedKeyError)
    await expect(
      twakeConfig(createTestConfigDesc(), mockFilePath)
    ).rejects.toThrow(
      "Configuration key 'unwanted_value' isn't accepted as it's not defined in the ConfigDescription."
    )
  })

  test('Should throw ConfigCoercionError for invalid boolean format from environment variable', async () => {
    process.env.BOOLEAN_KEY = 'not_a_boolean'
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(ConfigCoercionError)
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(
      /Configuration error for 'BOOLEAN_KEY' from environment variable 'BOOLEAN_KEY': Invalid boolean format for value: 'not_a_boolean'/
    )
  })

  test('Should throw ConfigCoercionError for invalid number format from environment variable', async () => {
    process.env.NUMBER_KEY = 'not_a_number'
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(ConfigCoercionError)
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(
      /Configuration error for 'NUMBER_KEY' from environment variable 'NUMBER_KEY': Invalid number format for value: 'not_a_number'/
    )
  })

  test('Should throw ConfigCoercionError for invalid JSON format from environment variable (JSON type)', async () => {
    process.env.JSON_KEY = '{invalid json'
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(ConfigCoercionError)
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(
      /Configuration error for 'JSON_KEY' from environment variable 'JSON_KEY': Invalid JSON format for value: '\{invalid json'/
    )
  })

  test('Should throw ConfigCoercionError for invalid JSON format from environment variable (OBJECT type)', async () => {
    process.env.OBJECT_KEY = 'invalid object json'
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(ConfigCoercionError)
    await expect(
      twakeConfig(createTestConfigDesc(), undefined, true)
    ).rejects.toThrow(
      /Configuration error for 'OBJECT_KEY' from environment variable 'OBJECT_KEY': Invalid JSON format for value: 'invalid object json'/
    )
  })

  test('Should throw FileReadParseError if config file is not found', async () => {
    const nonExistentPath = 'non_existent_config.json'
    ;(fs.existsSync as jest.Mock).mockReturnValue(false)
    ;(fs.promises.readFile as jest.Mock).mockImplementation(async () => {
      const error = new Error(
        `ENOENT: no such file or directory, open '${nonExistentPath}'`
      )
      ;(error as any).code = 'ENOENT'
      throw error
    })

    await expect(
      twakeConfig(createTestConfigDesc(), nonExistentPath)
    ).rejects.toThrow(FileReadParseError)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  test('Should throw FileReadParseError if config file contains invalid JSON', async () => {
    const invalidJsonPath = 'invalid.json'
    setupMockFs({
      [invalidJsonPath]: '{ "key": "value", "another": }'
    })

    await expect(
      twakeConfig(createTestConfigDesc(), invalidJsonPath)
    ).rejects.toThrow(FileReadParseError)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  test('Should handle null default values correctly', async () => {
    const res: Configuration = await twakeConfig(createTestConfigDesc())
    expect(res.NULL_KEY).toBeNull()
  })

  test('Should handle undefined default values correctly', async () => {
    const res: Configuration = await twakeConfig(createTestConfigDesc())
    expect(res.UNDEFINED_KEY).toBeUndefined()
    expect(res.NO_DEFAULT_KEY).toBeUndefined()
  })

  test('Should throw MissingRequiredConfigError if a required key is not provided', async () => {
    const descWithRequired: ConfigDescription = {
      MY_REQUIRED_KEY: { type: 'string', required: true }
    }
    await expect(twakeConfig(descWithRequired)).rejects.toThrow(
      MissingRequiredConfigError
    )
    await expect(twakeConfig(descWithRequired)).rejects.toThrow(
      "Required configuration key 'MY_REQUIRED_KEY' is missing."
    )
  })

  test('Should not throw MissingRequiredConfigError if a required key is provided by env', async () => {
    const descWithRequired: ConfigDescription = {
      MY_REQUIRED_KEY: { type: 'string', required: true }
    }
    process.env.MY_REQUIRED_KEY = 'present'
    const res: Configuration = await twakeConfig(
      descWithRequired,
      undefined,
      true
    )
    expect(res.MY_REQUIRED_KEY).toBe('present')
  })

  test('Should not throw MissingRequiredConfigError if a required key is provided by default', async () => {
    const descWithRequired: ConfigDescription = {
      MY_REQUIRED_KEY: {
        type: 'string',
        required: true,
        default: 'default_value'
      }
    }
    const res: Configuration = await twakeConfig(descWithRequired)
    expect(res.MY_REQUIRED_KEY).toBe('default_value')
  })
})
