# @twake/matrix-client-server

Node.js library that implements
[Matrix Client Server API](https://spec.matrix.org/v1.10/client-server-api/).

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

``js
import express from 'express'
import ClientServer from '@twake/matrix-client-server'

// TO DO : add correct path under
// if configuration is in default file (/etc/twake/client-server.conf)
const clServer = new ClientServer()

// else if configuration is in a different file, set TWAKE_IDENTITY_SERVER_CONF
process.env.TWAKE_IDENTITY_SERVER_CONF = '/path/to/config/file'
const clServer = new ClientServer()

// You can also give configuration directly
const clServer = new ClientServer(config)

const app = express()

clServer.ready.then( () => {
  Object.keys(clServer.api.get).forEach( k => {
    app.get(k, clServer.api.get[k])
  })

  Object.keys(clServer.api.post).forEach( k => {
    app.post(k, clServer.api.post[k])
  })

  Object.keys(clServer.api.put).forEach( k => {
    app.put(k, clServer.api.put[k])
  })

  Object.keys(clServer.api.delete).forEach( k => {
    app.delete(k, clServer.api.delete[k])
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
```
