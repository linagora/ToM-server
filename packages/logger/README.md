# @twake/logger

Configurable winston logger

## How to configure logger

Logger is based on [winston library](https://github.com/winstonjs/winston). This module allows to configure and create a winston logger via a JSON configuration file or via environment variables. Several properties and options are available to configure the logger.

### Environment variables

Three environment variables are available:
* LOG_TRANSPORTS: selects the "interface" to display logs. It must be equal to "Console" or "File" or event both "Console,File"
* LOG_LEVEL: selects the level of logs that should be displayed (available values from the most restrictive to the less restrictive: "error", "warn", "info", "http", "verbose", "debug", "silly")
* LOG_FILE: enables to specify the path to the file where logs should be written if LOG_TRANSPORTS is equal or contains the value "File"

```
LOG_TRANSPORTS=File
LOG_LEVEL=error
LOG_FILE=etc/twake/winston.log
```

### Configuration File

All winston's [core configuration properties](https://github.com/winstonjs/winston#logging) except `format` and `levels` can be set in a JSON configuration file. The property `transports` is set through the field `log_transports` which is detailed in the following part.  
There are three more available properties:
* default_meta: javascript object containing metadata that should be displayed in the log message
* exception_handlers: array containing transports which specify where uncaughtException events should be displayed (see [winston documention](https://github.com/winstonjs/winston#exceptions))
* rejection_handlers: array containing transports which specify where uncaughtRejection events should be displayed (see [winston documention](https://github.com/winstonjs/winston#rejections))

These properties should be the value of a `logging` field

```json
{
  "logging": {
    "log_level": "error",
    "silent": false,
    "log_transports": []
  }
}
```

NB: Winston `level` property is named `log_level`

#### Format

This loggger has a predefined format which is:  
`LEVEL | Date in ISO format | log message`

Between date and log message it is possible to add request details:
* ip: ip address where the request comes from
* matrixUserId: id of the user which sent the request
* requestURL: requested url
* endpointPath: requested API endpoint
* httpMethod: http method of the request
* status: response status

Any other detail can be added and it will be displayed after `log message  `

Aditionnal details are displayed in the following order:  
`LEVEL | Date in ISO format | ip | matrixUserId | httpMethod | requestURL | endpointPath | status | log message | additionnal details`

#### Transports

In this module, logger's `log_transports` field is set to an array of objects which contain two properties:
* type: winston transport that the logger should use. "Console" and "File" transports listed in this [winston documentation](https://github.com/winstonjs/winston/blob/master/docs/transports.md#built-in-to-winston) are available. The field's value must be the transport name and must start with a capital letter ("Console", "File").
* options: object containing selected transport options, they are all detailed on this [page](https://github.com/winstonjs/winston/blob/master/docs/transports.md#built-in-to-winston). 

NB: It is not specified in winston documentation but transport options can also contain the following properties:
* level: a string that specifies which logger level is associated with this transport 
* silent: boolean flag indicating whether to suppress output
* handleExceptions: boolean flag indicating that transport should log uncaughtException events
* handleRejections: boolean flag indicating that transport should log uncaughtRejection events

```json
{
  "logging": {
    "log_level": "error",
    "log_transports": [{
      "type": "Console",
      "options": {
        "level": "error",
        "consoleWarnLevels": ["error", "info"]
      }
    }]
  }
}
```

If no transports is specified in the configuration and description files, then the default value is `[{"type":"Console"}]`

NB: The `LOG_TRANSPORTS` environment property has the priority over the JSON configuration file/object `log_transports` field

#### Rotate File

This module enables to configure transports based on the [winston-daily-rotate-file library](https://github.com/winstonjs/winston-daily-rotate-file). Almost all options listed in this [documentation](https://github.com/winstonjs/winston-daily-rotate-file) are available in this module, only `stream` option is missing.

```json
{
  "logging": {
    "log_level": "error",
    "log_transports": [{
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
For the following properties: log_level, silent, exit_on_error if they are `null` or `undefined` both in configuration and description files then the default values will come from winston library.  
Transports options default values will come from winston library too, except for `filename` option

#### Logs in file

When `LOG_TRANSPORTS` is set to "File" or contain "File"
```sh
LOG_TRANSPORTS=File
# or
LOG_TRANSPORTS=Console,File
```
If `LOG_FILE` is not set then the default filename will be `twake.log`

Same with JSON configuration file or conf object, if `log_transports` array contains a `File` transport and no options are specified
```ts
logging: {
  ...
  log_transports: [
    {type: 'File'}
  ]
  ...
}
```
If `filename` option and `LOG_FILE` are not set, when `logTransports` contains "File", then the default filename will be `twake.log`

For rotate file, it will only check `filename` option and if it is not set the default filename will be `twake-%DATE%.log` with `%DATE%` replaced by the day date.

## How to use it

### Create logger

To create a logger you have to use the `getLogger` method. It takes two optional parameters, `conf` and `confDesc`, two configuration objects as described before

First, the module checks if we have defined the path to a configuration file in the `TWAKE_LOGGER_CONF` environment variable. Otherwise, it will check if the file `etc/twake/logger.conf` exists and read the configuration from this file. Then, it will check if `conf` is not `null` or `undefined`, and use it if it is the case. If none of these options work, the configuration will come from `src/config.json` file or your custom description object.

You can define your own description object as the second parameter of `getLogger` method, but it is not recommended to set this property.

Example: `conf` parameter not `null`
```ts
import { EFormatType, ETransportType, getLogger } from '@twake/logger'

const logger = getLogger({
  logging: {
    log_level: 'error',
    log_transports: [
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
/*
  For example, home/dwho/logger.conf file content is:
  {
    logging: {
      log_level: 'error',
      log_transports: [
        {
          type: ETransportType.FILE,
          options: {
            dirname: 'etc/twake/logs',
            filename: 'twake.log'
          }
        }
      ]
    }
  }
*/
```

Example: `etc/twake/logger.conf` file exists
```ts
import { getLogger } from '@twake/logger'

const logger = getLogger()
/*
  For example, etc/twake/logger.conf file content is:
  {
    logging: {
      log_level: 'error',
      log_transports: [
        {
          type: ETransportType.FILE,
          options: {
            dirname: 'etc/twake/logs',
            filename: 'twake.log'
          }
        }
      ]
    }
  }
*/
```

Example: use default configuration from `src/config.json`
```ts
import { getLogger } from '@twake/logger'

const logger = getLogger()
/*
  src/config.json file content is:
  {
    "logging": {
      "log_level": "info",
      "log_transports": [{
        "type":"Console"
      }],
      "silent": false,
      "exit_on_error": false,
      "default_meta": null,
      "exception_handlers": [],
      "rejection_handlers": []
    }
  }
*/
```

Example: use your own configuration description object
```ts
import { EFormatType, ETransportType, getLogger } from '@twake/logger'

const logger = getLogger(null, {
  logging: {
    log_level: 'error',
    log_transports: [
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

### Use logger methods

The created logger can log messages thanks to the following methods:
* `error(message: string, details?: Record<string, string| number>)`
* `warn(message: string, details?: Record<string, string| number>)`
* `info(message: string, details?: Record<string, string| number>)`
* `http(message: string, details?: Record<string, string| number>)`
* `verbose(message: string, details?: Record<string, string| number>)`
* `debug(message: string, details?: Record<string, string| number>)`
* `silly(message: string, details?: Record<string, string| number>)`

```ts
import { getLogger } from '@twake/logger'

const logger = getLogger()

logger.error('This is an error message')
// Output: ERROR | 2028-12-08T21:36:22.011Z | This is an error message

logger.info(
  'This is an info message',
  {
    ip: '127.0.0.1',
    matrixUserId: '@dwho:example.com',
    httpMethod: 'GET',
    requestUrl: 'https://example.com/example/how/to/use/logger',
    endpointPath: '/example/how/to/use/logger',
    status: 200,
    detail1: 'additionnal detail 1',
    detail2: 'additionnal detail 2'
  }
)
// Output: INFO | 2028-12-08T21:36:22.011Z | 127.0.0.1 | @dwho:example.com | GET | https://example.com/example/how/to/use/logger | /example/how/to/use/logger | This is an info message | additionnal detail 1 | additionnal detail 2

// Order of additionnal details does not matter
logger.debug(
  'This is a debug message',
  {
    endpointPath: '/example/how/to/use/logger',
    httpMethod: 'GET',
    requestUrl: 'https://example.com/example/how/to/use/logger',
    matrixUserId: '@dwho:example.com',
    ip: '127.0.0.1',
    status: 200,
    detail1: 'additionnal detail 1',
    detail2: 'additionnal detail 2'
  }
)
// Output: DEBUG | 2028-12-08T21:36:22.011Z | 127.0.0.1 | @dwho:example.com | GET | https://example.com/example/how/to/use/logger | /example/how/to/use/logger | 200 | This is a debug message | additionnal detail 1 | additionnal detail 2

logger.silly(
  'This is an info message',
  {
    endpointPath: '/example/how/to/use/logger',
    httpMethod: 'GET',
    matrixUserId: '@dwho:example.com',
    status: 200
  }
)
// Output: SILLY | 2028-12-08T21:36:22.011Z | @dwho:example.com | GET | /example/how/to/use/logger | 200 | This is a silly message

// Methods won't crash if they are called with unsupported additionnal detail 
logger.debug(
  'This is an debug message',
  {
    endpointPath: '/example/how/to/use/logger',
    httpMethod: 'GET',
    matrixUserId: '@dwho:example.com',
    status: 200,
    falsyDetail: 'falsy'
  }
)
// Output: DEBUG | 2028-12-08T21:36:22.011Z | @dwho:example.com | GET | /example/how/to/use/logger | 200 | This is a debug message

```

The `log` method is also available and requires one more parameter to specify log level

```ts
import { getLogger } from '@twake/logger'

const logger = getLogger()
logger.log('error', 'This is an error message')
// Output: ERROR | 2028-12-08T21:36:22.011Z | This is an error message

logger.log(
  'info',
  'This is an info message',
  {
    ip: '127.0.0.1',
    matrixUserId: '@dwho:example.com',
    httpMethod: 'GET',
    requestUrl: 'https://example.com/example/how/to/use/logger',
    endpointPath: '/example/how/to/use/logger',
    status: 200,
    detail1: 'additionnal detail 1',
    detail2: 'additionnal detail 2'
  }
)
// Output: INFO | 2028-12-08T21:36:22.011Z | 127.0.0.1 | @dwho:example.com | GET | https://example.com/example/how/to/use/logger | /example/how/to/use/logger | This is an info message | additionnal detail 1 | additionnal detail 2
```

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
