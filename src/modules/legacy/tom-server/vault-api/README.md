# @twake/vault-api

Node.js library that implements a vault API to store messages recovery sentence for each matrix user id.

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express'
import TwakeVaultAPI from '@twake/vault-api'

// if configuration is in default file (/etc/twake/vault-server.conf)
const vaultApiServer = new TwakeVaultAPI()

// else if configuration is in a different file, set TWAKE_VAULT_SERVER_CONF
process.env.TWAKE_VAULT_SERVER_CONF = '/path/to/config/file'
const vaultApiServer = new TwakeVaultAPI()

// You can also give configuration directly
const vaultApiServer = new TwakeVaultAPI(config)

const app = express()

vaultApiServer.ready
  .then(() => {
    app.use(vaultApiServer.endpoints)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
```

## Configuration file

Configuration file is a JSON file. The default values are
in [src/config.json](./src/config.json).

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
