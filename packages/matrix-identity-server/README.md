# @twake/matrix-identity-server

Node.js library that implements
[Matrix Identity Service API](https://spec.matrix.org/v1.6/identity-service-api/).

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express'
import IdServer from '@twake/matrix-identity-server'

// if configuration is in default file (/etc/twake/identity-server.conf)
const idServer = new IdServer()

// else if configuration is in a different file, set TWAKE_IDENTITY_SERVER_CONF
process.env.TWAKE_IDENTITY_SERVER_CONF = '/path/to/config/file'
const idServer = new IdServer()

// You can also give configuration directly
const idServer = new IdServer(config)

const app = express()

idServer.ready.then( () => {
  Object.keys(idServer.api.get).forEach( k => {
    app.get(k, idServer.api.get[k])
  })

  Object.keys(idServer.api.post).forEach( k => {
    app.post(k, idServer.api.get[k])
  })

  app.listen(3000)
})
```

## Configuration file

Configuration file is a JSON file. The default values are
in [src/config.json](./src/config.json).

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
