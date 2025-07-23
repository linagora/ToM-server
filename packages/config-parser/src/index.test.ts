import twakeConfig, { ConfigDescription, ConfigProperty, ConfigValueType, FileReadParseError, UnacceptedKeyError, ConfigCoercionError, MissingRequiredConfigError } from './index'; // Adjust path as needed
import fs from 'fs';
import path from 'path';

// Mock fs module to prevent actual file system operations during tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'), // Import and retain default behavior
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  writeFileSync: jest.fn(), // Added for test data setup
  mkdirSync: jest.fn(), // Added for test data setup
  promises: { // Mock the promises API for async operations
    readFile: jest.fn(),
  },
}));

// Helper function to create a ConfigDescription object for tests
const createTestConfigDesc = (): ConfigDescription => ({
  STRING_KEY: { type: 'string', default: 'defaultString' },
  NUMBER_KEY: { type: 'number', default: 100 },
  BOOLEAN_KEY: { type: 'boolean', default: true },
  ARRAY_KEY: { type: 'array', default: ['defaultArrayItem'] },
  JSON_KEY: { type: 'json', default: { default: 'json' } },
  NULL_KEY: { type: 'string', default: null },
  UNDEFINED_KEY: { type: 'string', default: undefined },
  NO_DEFAULT_KEY: { type: 'string' }, // No default value
  REQUIRED_KEY: { type: 'string', required: true }, // New required key for testing
});

// Helper to clear environment variables
const clearEnv = () => {
  // Get all keys from a typical ConfigDescription and delete their uppercase versions
  const testDesc = createTestConfigDesc();
  Object.keys(testDesc).forEach(key => {
    delete process.env[key.toUpperCase()];
  });
  // Also clear specific test env vars
  delete process.env.TEST_ENV_STRING;
  delete process.env.TEST_ENV_NUMBER;
  delete process.env.TEST_ENV_BOOLEAN;
  delete process.env.TEST_ENV_ARRAY;
  delete process.env.TEST_ENV_JSON;
  delete process.env.UNWANTED_VALUE;
};

// Setup mock file system for tests
// Note: For async readFile, we mock fs.promises.readFile
const setupMockFs = (files: { [key: string]: string }) => {
  (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
    return Object.keys(files).some(mockPath => path.resolve(mockPath) === path.resolve(filePath));
  });
  (fs.promises.readFile as jest.Mock).mockImplementation(async (filePath: string) => {
    const content = files[filePath];
    if (content === undefined) {
      // Simulate file not found error for fs.promises.readFile
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as any).code = 'ENOENT'; // Mimic Node.js error code
      throw error;
    }
    return content;
  });
};


describe('twakeConfig - Basic Cases', () => {
  beforeEach(() => {
    clearEnv();
    (fs.promises.readFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
  });

  test('Should return default values when no file or env vars are provided', async () => {
    const res = await twakeConfig(createTestConfigDesc());
    expect(res).toEqual({
      STRING_KEY: 'defaultString',
      NUMBER_KEY: 100,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined, // No default for required key, so it's undefined
    });
  });

  test('Should load config from file and override defaults', async () => {
    const mockFilePath = 'config.json';
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'fileString',
        NUMBER_KEY: 200,
      }),
    });

    const res = await twakeConfig(createTestConfigDesc(), mockFilePath);
    expect(res).toEqual({
      STRING_KEY: 'fileString',
      NUMBER_KEY: 200,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
    expect(fs.promises.readFile).toHaveBeenCalledWith(mockFilePath, 'utf8');
  });

  test('Should load config from object and override defaults', async () => {
    const initialConfig = {
      STRING_KEY: 'objectString',
      BOOLEAN_KEY: false,
    };
    const res = await twakeConfig(createTestConfigDesc(), initialConfig);
    expect(res).toEqual({
      STRING_KEY: 'objectString',
      NUMBER_KEY: 100,
      BOOLEAN_KEY: false,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
  });

  test('Should override defaults with environment variables when useEnv is true', async () => {
    process.env.STRING_KEY = 'envString';
    process.env.NUMBER_KEY = '300';
    process.env.BOOLEAN_KEY = 'false';

    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res).toEqual({
      STRING_KEY: 'envString',
      NUMBER_KEY: 300,
      BOOLEAN_KEY: false,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
  });
});

describe('twakeConfig - Easy Cases (Mixed Sources)', () => {
  beforeEach(() => {
    clearEnv();
    (fs.promises.readFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
  });

  test('Environment variables should override file values', async () => {
    const mockFilePath = 'config.json';
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'fileString',
        NUMBER_KEY: 200,
        BOOLEAN_KEY: false,
      }),
    });

    process.env.STRING_KEY = 'envOverrideString';
    process.env.NUMBER_KEY = '999';
    process.env.BOOLEAN_KEY = 'true';

    const res = await twakeConfig(createTestConfigDesc(), mockFilePath, true);
    expect(res).toEqual({
      STRING_KEY: 'envOverrideString',
      NUMBER_KEY: 999,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
  });

  test('File values should override defaults when env vars are not used', async () => {
    const mockFilePath = 'config.json';
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'fileString',
        NUMBER_KEY: 200,
        BOOLEAN_KEY: false,
      }),
    });

    process.env.STRING_KEY = 'thisShouldBeIgnored';

    const res = await twakeConfig(createTestConfigDesc(), mockFilePath, false);
    expect(res).toEqual({
      STRING_KEY: 'fileString',
      NUMBER_KEY: 200,
      BOOLEAN_KEY: false,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
  });
});

describe('twakeConfig - Medium Cases (Coercion Details)', () => {
  beforeEach(() => {
    clearEnv();
    (fs.promises.readFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
  });

  test('Array type coercion from comma-separated string', async () => {
    process.env.ARRAY_KEY = 'item1,item2, item3 , item4';
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.ARRAY_KEY).toEqual(['item1', 'item2', 'item3', 'item4']);
  });

  test('Array type coercion from space-separated string', async () => {
    process.env.ARRAY_KEY = 'itemA itemB  itemC';
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.ARRAY_KEY).toEqual(['itemA', 'itemB', 'itemC']);
  });

  test('JSON type coercion from simple JSON string', async () => {
    process.env.JSON_KEY = '{"name": "test", "value": 123}';
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.JSON_KEY).toEqual({ name: 'test', value: 123 });
  });

  test('Boolean coercion with "1" and "0"', async () => {
    process.env.BOOLEAN_KEY = '1';
    let res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.BOOLEAN_KEY).toBe(true);

    process.env.BOOLEAN_KEY = '0';
    res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.BOOLEAN_KEY).toBe(false);
  });

  test('Boolean coercion with mixed case "TRUE" and "FALSE"', async () => {
    process.env.BOOLEAN_KEY = 'TRUE';
    let res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.BOOLEAN_KEY).toBe(true);

    process.env.BOOLEAN_KEY = 'fAlSe';
    res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.BOOLEAN_KEY).toBe(false);
  });
});

describe('twakeConfig - Hard Cases (Complex Coercion & Defaults)', () => {
  beforeEach(() => {
    clearEnv();
    (fs.promises.readFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
  });

  test('JSON type coercion from complex JSON string', async () => {
    process.env.JSON_KEY = '{"data": [{"id": 1, "val": "a"}, {"id": 2, "val": "b"}], "meta": {"version": "1.0"}}';
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.JSON_KEY).toEqual({ data: [{ id: 1, val: 'a' }, { id: 2, val: 'b' }], meta: { version: '1.0' } });
  });

  test('Array coercion with empty string items', async () => {
    process.env.ARRAY_KEY = 'item1,,item2';
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.ARRAY_KEY).toEqual(['item1', 'item2']);

    process.env.ARRAY_KEY = '';
    const resEmpty = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(resEmpty.ARRAY_KEY).toEqual([]);
  });

  test('Default value is a string but needs coercion to target type', async () => {
    const descWithCoercibleDefault: ConfigDescription = {
      NUM_FROM_STRING: { type: 'number', default: '42' },
      BOOL_FROM_STRING: { type: 'boolean', default: 'true' },
    };
    const res = await twakeConfig(descWithCoercibleDefault);
    expect(res.NUM_FROM_STRING).toBe(42);
    expect(res.BOOL_FROM_STRING).toBe(true);
  });

  test('Default value is already correct type, no coercion needed', async () => {
    const descWithCorrectDefault: ConfigDescription = {
      NUM_FROM_NUMBER: { type: 'number', default: 42 },
      BOOL_FROM_BOOLEAN: { type: 'boolean', default: true },
    };
    const res = await twakeConfig(descWithCorrectDefault);
    expect(res.NUM_FROM_NUMBER).toBe(42);
    expect(res.BOOL_FROM_BOOLEAN).toBe(true);
  });
});

describe('twakeConfig - Side Effects', () => {
  beforeEach(() => {
    clearEnv();
    (fs.promises.readFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
  });

  test('Should not modify the input ConfigDescription object', async () => {
    const originalDesc = createTestConfigDesc();
    const descCopy = JSON.parse(JSON.stringify(originalDesc));
    await twakeConfig(originalDesc);
    expect(originalDesc).toEqual(descCopy);
  });

  test('Should not modify the input defaultConfigurationFile object', async () => {
    const originalFileConfig = {
      STRING_KEY: 'initial',
      NUMBER_KEY: 123,
    };
    const fileConfigCopy = JSON.parse(JSON.stringify(originalFileConfig));
    await twakeConfig(createTestConfigDesc(), originalFileConfig);
    expect(originalFileConfig).toEqual(fileConfigCopy);
  });
});

describe('twakeConfig - Edge Cases and Error Handling', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    clearEnv();
    (fs.promises.readFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // Spy on console.warn
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore(); // Restore console.warn after each test
  });

  test('Should fall back to default if environment variable is empty string', async () => {
    process.env.STRING_KEY = '';
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.STRING_KEY).toBe('defaultString');
  });

  test('Should fall back to default if environment variable is null/undefined (not set)', async () => {
    const res = await twakeConfig(createTestConfigDesc(), undefined, true);
    expect(res.STRING_KEY).toBe('defaultString');
  });

  test('Should throw UnacceptedKeyError for unwanted key in defaultConfigurationFile object', async () => {
    const initialConfig = {
      STRING_KEY: 'valid',
      UNWANTED_KEY_FROM_OBJECT: 'bad',
    };
    await expect(twakeConfig(createTestConfigDesc(), initialConfig)).rejects.toThrow(UnacceptedKeyError);
    await expect(twakeConfig(createTestConfigDesc(), initialConfig)).rejects.toThrow(
      "Configuration key 'UNWANTED_KEY_FROM_OBJECT' isn't accepted as it's not defined in the ConfigDescription."
    );
  });

  test('Should throw UnacceptedKeyError for unwanted key in defaultConfigurationFile (JSON file)', async () => {
    const mockFilePath = 'unwanted_key_file.json';
    setupMockFs({
      [mockFilePath]: JSON.stringify({
        STRING_KEY: 'valid',
        unwanted_value: 'bad',
      }),
    });
    await expect(twakeConfig(createTestConfigDesc(), mockFilePath)).rejects.toThrow(UnacceptedKeyError);
    await expect(twakeConfig(createTestConfigDesc(), mockFilePath)).rejects.toThrow(
      "Configuration key 'unwanted_value' isn't accepted as it's not defined in the ConfigDescription."
    );
  });

  test('Should throw ConfigCoercionError for invalid boolean format from environment variable', async () => {
    process.env.BOOLEAN_KEY = 'not_a_boolean';
    await expect(twakeConfig(createTestConfigDesc(), undefined, true)).rejects.toThrow(ConfigCoercionError);
    await expect(twakeConfig(createTestConfigDesc(), undefined, true)).rejects.toThrow(
      /Configuration error for 'BOOLEAN_KEY' from environment variable 'BOOLEAN_KEY': Invalid boolean format for value: 'not_a_boolean'/
    );
  });

  test('Should throw ConfigCoercionError for invalid number format from environment variable', async () => {
    process.env.NUMBER_KEY = 'not_a_number';
    await expect(twakeConfig(createTestConfigDesc(), undefined, true)).rejects.toThrow(ConfigCoercionError);
    await expect(twakeConfig(createTestConfigDesc(), undefined, true)).rejects.toThrow(
      /Configuration error for 'NUMBER_KEY' from environment variable 'NUMBER_KEY': Invalid number format for value: 'not_a_number'/
    );
  });

  test('Should throw ConfigCoercionError for invalid JSON format from environment variable', async () => {
    process.env.JSON_KEY = '{invalid json';
    await expect(twakeConfig(createTestConfigDesc(), undefined, true)).rejects.toThrow(ConfigCoercionError);
    await expect(twakeConfig(createTestConfigDesc(), undefined, true)).rejects.toThrow(
      /Configuration error for 'JSON_KEY' from environment variable 'JSON_KEY': Invalid JSON format for value: '\{invalid json'/
    );
  });

  test('Should log warning and return config with defaults if config file is not found', async () => {
    const nonExistentPath = 'non_existent_config.json';
    (fs.existsSync as jest.Mock).mockReturnValue(false); // Ensure existsSync returns false
    // Mock readFile to throw the specific error that loadConfigFromFile would throw
    (fs.promises.readFile as jest.Mock).mockImplementation(async () => {
      const error = new Error(`ENOENT: no such file or directory, open '${nonExistentPath}'`);
      (error as any).code = 'ENOENT';
      throw error;
    });

    const res = await twakeConfig(createTestConfigDesc(), nonExistentPath);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Warning: Could not load configuration from file '${nonExistentPath}'. Proceeding without it.`)
    );
    // Expect the result to be based on defaults, as file load failed and config was reset to {}
    expect(res).toEqual({
      STRING_KEY: 'defaultString',
      NUMBER_KEY: 100,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
  });

  test('Should log warning and return config with defaults if config file contains invalid JSON', async () => {
    const invalidJsonPath = 'invalid.json';
    setupMockFs({
      [invalidJsonPath]: '{ "key": "value", "another": }', // Malformed JSON
    });

    const res = await twakeConfig(createTestConfigDesc(), invalidJsonPath);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Warning: Could not load configuration from file '${invalidJsonPath}'. Proceeding without it.`)
    );
    // Expect the result to be based on defaults, as file load failed and config was reset to {}
    expect(res).toEqual({
      STRING_KEY: 'defaultString',
      NUMBER_KEY: 100,
      BOOLEAN_KEY: true,
      ARRAY_KEY: ['defaultArrayItem'],
      JSON_KEY: { default: 'json' },
      NULL_KEY: null,
      UNDEFINED_KEY: undefined,
      NO_DEFAULT_KEY: undefined,
      REQUIRED_KEY: undefined,
    });
  });

  test('Should handle null default values correctly', async () => {
    const res = await twakeConfig(createTestConfigDesc());
    expect(res.NULL_KEY).toBeNull();
  });

  test('Should handle undefined default values correctly', async () => {
    const res = await twakeConfig(createTestConfigDesc());
    expect(res.UNDEFINED_KEY).toBeUndefined();
    expect(res.NO_DEFAULT_KEY).toBeUndefined();
  });

  test('Should throw MissingRequiredConfigError if a required key is not provided', async () => {
    const descWithRequired: ConfigDescription = {
      MY_REQUIRED_KEY: { type: 'string', required: true },
    };
    await expect(twakeConfig(descWithRequired)).rejects.toThrow(MissingRequiredConfigError);
    await expect(twakeConfig(descWithRequired)).rejects.toThrow(
      "Required configuration key 'MY_REQUIRED_KEY' is missing."
    );
  });

  test('Should not throw MissingRequiredConfigError if a required key is provided by env', async () => {
    const descWithRequired: ConfigDescription = {
      MY_REQUIRED_KEY: { type: 'string', required: true },
    };
    process.env.MY_REQUIRED_KEY = 'present';
    const res = await twakeConfig(descWithRequired, undefined, true);
    expect(res.MY_REQUIRED_KEY).toBe('present');
  });

  test('Should not throw MissingRequiredConfigError if a required key is provided by default', async () => {
    const descWithRequired: ConfigDescription = {
      MY_REQUIRED_KEY: { type: 'string', required: true, default: 'default_value' },
    };
    const res = await twakeConfig(descWithRequired);
    expect(res.MY_REQUIRED_KEY).toBe('default_value');
  });
});
