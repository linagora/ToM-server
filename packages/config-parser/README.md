# @twake/config-parser

Simple module to load and consolidate application configuration.

# Synopsis

```ts
import twakeConfig from './index';
import { ConfigDescription } from './types'; // Import ConfigDescription type

// Define your configuration schema
const appConfigDescription: ConfigDescription = {
  DATABASE_URL: { type: 'string', required: true }, // Required key
  PORT: { type: 'number', default: 3000 }, // Number with a default
  ENABLE_FEATURE_X: { type: 'boolean', default: false }, // Boolean with a default
  API_KEYS: { type: 'json', default: {} }, // JSON object with a default empty object
  ALLOWED_ORIGINS: { type: 'array', default: ['http://localhost:8080'] } // Array with default items
};

// Path to an optional JSON configuration file
const optionalConfFile = './config.json';

async function loadConfiguration() {
  try {
    // Example 1: Load with defaults only
    const config1 = await twakeConfig(appConfigDescription);
    console.log('Config 1 (Defaults):', config1);
    // Expected: { DATABASE_URL: undefined, PORT: 3000, ENABLE_FEATURE_X: false, API_KEYS: {}, ALLOWED_ORIGINS: ['http://localhost:8080'] }
    // Note: DATABASE_URL will cause MissingRequiredConfigError if not provided by env or file

    // Example 2: Load with a config file, overriding defaults
    // Assume config.json contains: { "PORT": 8080, "ENABLE_FEATURE_X": true }
    // And you set DATABASE_URL via environment: export DATABASE_URL="my_prod_db"
    const config2 = await twakeConfig(appConfigDescription, optionalConfFile, true);
    console.log('Config 2 (File + Env):', config2);
    // Expected: { DATABASE_URL: "my_prod_db", PORT: 8080, ENABLE_FEATURE_X: true, API_KEYS: {}, ALLOWED_ORIGINS: ['http://localhost:8080'] }

    // Example 3: Explicitly setting an environment variable to an empty string (will throw an error)
    // process.env.DATABASE_URL = ""; // Simulate setting an empty env var
    // await twakeConfig(appConfigDescription, undefined, true); // This line would throw ConfigCoercionError

  } catch (error) {
    console.error('Configuration loading error:', error.message);
    // You can catch specific errors:
    // if (error instanceof MissingRequiredConfigError) { ... }
    // if (error instanceof ConfigCoercionError) { ... }
  }
}

loadConfiguration();
```

# How it works

`twakeConfig()` is an asynchronous function that loads and consolidates application configuration from multiple sources, applying a clear priority order:

1. **Optional Configuration File**: If a path to a JSON file (*or a plain object*) is provided as `defaultConfigurationFile`, its values are loaded first. These values serve as the base configuration. If the file is not found, cannot be read, or contains invalid JSON, a `FileReadParseError` will be thrown.
2. **Environment Variables**: If the `useEnv` parameter is set to `true`, environment variables are checked. For each key defined in your `ConfigDescription`, `twakeConfig()` looks for an environment variable with the key's name converted to uppercase (*e.g., `myKey` maps to `MYKEY`*). If found, this environment variable's value will override any corresponding value from the configuration file or `ConfigDescription` default. **Important**: Empty string environment variables (*e.g., `export MY_KEY=""`*) are explicitly not allowed and will cause a `ConfigCoercionError` to be thrown, as they are considered invalid inputs.
3. **ConfigDescription Defaults**: Finally, for any configuration keys that were not set by the configuration file or environment variables, their default values (*if defined*) from the `ConfigDescription` will be applied.

All values, whether from environment variables or `ConfigDescription` defaults, are automatically type-coerced to the type specified in the `ConfigDescription`. This includes:

- Strings to number (*e.g., `"123"` -> `123`*)
- Strings to boolean (*e.g., `"true"`, `"1"` -> `true`; `"false"`, `"0"` -> `false`*)
- Comma or space-separated strings to array (*e.g., `"item1, item2"` -> `['item1', 'item2']`*)
- JSON strings to object or json types (*e.g., `'{"key": "value"}'` -> `{ key: 'value' }`*)

The module also includes robust validation and throws specific errors for various issues:

- `UnacceptedKeyError`: Thrown if a key is found in the provided `defaultConfigurationFile` (*`object` or JSON file*) that is not defined in the `ConfigDescription`.
- `ConfigCoercionError`: Thrown if a value from an environment variable or a default value cannot be successfully coerced to its specified type. This also applies to empty string environment variables.
- `MissingRequiredConfigError`: Thrown if a configuration key marked as required: true in your ConfigDescription is not provided by any of the configuration sources (file, environment, or default).

# Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
