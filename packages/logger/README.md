# @twake/logger

Configurable winston logger

## How to configure logger

Logger is based on [winston library](https://github.com/winstonjs/winston). This module enables to configure a winston logger via a JSON configuration file or via environment variables and create it. Several properties and options are available to configure the logger.

### Environment variables

Three environment variables are available:
* LOGGER: select the "interface" to display logs. It must be equal to "Console" or "File"
* LOGLEVEL: select the level of logs that should be displayed (available values from the most restrictive to the less restrictive: "error", "warn", "info", "http", "verbose", "debug", "silly")
* LOGFILE: if LOGGER is equal to "File", then it enables to specify the file where logs should be written. The value must be a string

```
LOGGER=File
LOGLEVEL=error
LOGFILE=etc/twake/winston.log
```

### Configuration File

All winston's [core configuration properties](https://github.com/winstonjs/winston#logging) can be set in the JSON configuration file. There are also three more available properties:
* defaultMeta: javascript object containing metadata that should be displayed in the log message
* exceptionHandlers: array containing transports which specify where uncaughtException events should be displayed (see [winston documention](https://github.com/winstonjs/winston#exceptions))
* rejectionHandlers: array containing transports which specify where uncaughtRejection events should be displayed (see [winston documention](https://github.com/winstonjs/winston#rejections))

These properties should be the value of a `logging` field

```json
{
  "logging": {
    "logLevel": "error",
    "silent": false,
    "transports": []
  }
}
```

NB: Winston `level` property is named `logLevel` here

#### Format

In this module, logger's format is set to an object which contains two properties:
* type: winston format the logger should use. Almost all formats listed in this [winston documentation](https://github.com/winstonjs/logform#formats) are available, only 'combine' is not available. The field's value must be the format name and must start with a lowercase letter (examples: "align", "cli", "colorize", ...).
* options: object containing selected format's options, they are all detailed on this [page](https://github.com/winstonjs/logform#formats). There is just one difference with `printf` format, options must contain a `template` property whose value is a string and must contain "${info.level}" and "${info.message}".

```json
{
  "logging": {
    "logLevel": "info",
    "format": {
      "type": "colorize" ,
      "options": {
        "message": false,
        "level": true
      }
    }
  } 
}
```

Example for `printf` format

```json
{
  "logging": {
    "logLevel": "info",
    "format": {
      "type": "printf" ,
      "options": {
        "template": "[${info.level}] Here a new log: ${info.message}"
      }
    }
  } 
}
```

NB: `align`, `simple`, `logstash`, `splat` do not have options. For `printf` options are required, and for all other formats they are optional

If you want to use `combine` format, the `format` field should contain an array

```json
{
  "logging": {
    "logLevel": "info",
    "format": [{
      "type": "align", 
    }, {
      "type": "colorize" ,
      "options": {
        "message": false,
        "level": true
      }
    }]
  } 
}
```

If no format is specified in the configuration and description files, then the default value is `winston.format.simple()`

#### Transports

In this module, logger's `transports` field is set to an array of objects which contain two properties:
* type: winston transport the logger should use. All built-in transports listed in this [winston documentation](https://github.com/winstonjs/winston/blob/master/docs/transports.md#built-in-to-winston) are available. The field's value must be the transport name and must start with a capital letter (examples: "Console", "File", ...).
* options: object containing selected transport options, they are all detailed on this [page](https://github.com/winstonjs/winston/blob/master/docs/transports.md#built-in-to-winston). 

NB: It is not specified in winston documentation but transport options can also contain the following properties:
* format: an object or an array of objects like the ones described in the Format part of this file
* level: a string that specifies which logger level is associated with this transport 
* silent: boolean flag indicating whether to suppress output
* handleExceptions: boolean flag indicating that transport should log uncaughtException events
* handleRejections: boolean flag indicating that transport should log uncaughtRejection events

```json
{
  "logging": {
    "logLevel": "error",
    "transports": [{
      "type": "Console",
      "options": {
        "format": {
            "type": "align"
        },
        "level": "error",
        "consoleWarnLevels": ["error", "info"]
      }
    }]
  }
}
```

For `Stream` transport, there are two more options: 
* parentDirPath: to specify the path to the folder containing the log file (default value: the folder where the logger is created)
* filename: the log file name (default value: "twake.log")

```json
{
  "logging": {
    "logLevel": "error",
    "transports": [{
      "type": "Stream",
      "options": {
        "parentDirPath": "etc/twake",
        "filename": "test.log"
      }
    }]
  }
}
```

If no transports is specified in the configuration and description files, then the default value is `[]`

#### Rotate File

This module enables to configure transports based on the [winston-daily-rotate-file library](https://github.com/winstonjs/winston-daily-rotate-file). Almost all options listed in this [documentation](https://github.com/winstonjs/winston-daily-rotate-file) are available in this module, only `stream` option is missing.

```json
{
  "logging": {
    "logLevel": "error",
    "transports": [{
      "type":"DailyRotateFile",
      "options": {
        "zippedArchive": true,
        "dirname":"./logs",
        "filename": "twake-%DATE%.log",
        "maxSize": "10m",
        "maxFiles": "5d"
      }
    }],
  }
}
```

### Default values

All default values are defined in the configuration description file `src/config.json` or your custom description object.  
For the following properties: logLevel, levels, silent, exitOnError if they are `null` or `undefined` both in configuration and description files then the default values will come from winston library.  
Formats options and transports options default values will come from winston library too.

## How to use it

To create a logger you have to use the `getLogger` method. It takes two optional parameters, `conf` and `confDesc`, two configuration objects as described before

If `conf` is `null` or `undefined`, then the module will check if we have defined the path to a configuration file in the `TWAKE_LOGGER_CONF` environment variable. Otherwise, it will check if the file `etc/twake/logger.conf` exists and read the configuration from this file. If none of these options work then the configuration will come from `src/config.json` file or your custom description object.

You can define your own description object as the second parameter of `getLogger` method.

Example: `conf` parameter not `null`
```ts
import { EFormatType, ETransportType, getLogger } from '@twake/logger'

const logger = getLogger({
  logging: {
    logLevel: 'error',
    format: {
      type: EFormatType.CLI
    },
    transports: [
      {
        type: ETransportType.FILE,
        options: {
          dirname: 'etc/twake/logs',
          filename: 'twake.log'
        }
      }
    ]
  }
})
```

Example: set `TWAKE_LOGGER_CONF` with configuration file path
```ts
import { getLogger } from '@twake/logger'

process.env.TWAKE_LOGGER_CONF = 'home/dwho/logger.conf'
const logger = getLogger()
```

Example: `etc/twake/logger.conf` file exists
```ts
import { getLogger } from '@twake/logger'

const logger = getLogger()
```

Example: use default configuration from `src/config.json`
```ts
import { getLogger } from '@twake/logger'

const logger = getLogger()
```

Example: use your own configuration description object
```ts
import { EFormatType, ETransportType, getLogger } from '@twake/logger'

const logger = getLogger(null, {
  logging: {
    logLevel: 'error',
    format: {
      type: EFormatType.CLI
    },
    transports: [
      {
        type: ETransportType.FILE,
        options: {
          dirname: 'etc/twake/logs',
          filename: 'twake.log'
        }
      }
    ]
  }
})
```

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
