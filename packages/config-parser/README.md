# @twake/config-parser

Simple module to load a configuration

## Synopsis

```js
import twakeConfig from '@twake/config-parser'

const desc = {
  value_1: null,   // configuration key without default value
  value_2: 'val2', // configuration key with default value
}

const optionalConfFile = '/etc/my/conf.json'

const conf = twakeConfig(desc, optionalConfFile)
```

## How it works

`twakeConfig()` reads optional configuration file if given. Then
it parse environment variables to see if `key.toUpperCase()` exists.
If yes, it uses this value for this key, else it uses default value
if exists.
Then it returns the result.

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
