# @twake/federation-server

Node.js library that implements
[Matrix Identity Service API](https://spec.matrix.org/v1.6/identity-service-api/) and [this proposal](https://github.com/guimard/matrix-spec-proposals/blob/unified-identity-service/proposals/4004-unified-identity-service-view.md)

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express'
import FederationServer from '@twake/federation-server'

// if configuration is in default file (/etc/twake/federation-server.conf)
const federationServer = new FederationServer()

// else if configuration is in a different file, set TWAKE_FEDERATION_SERVER_CONF
process.env.TWAKE_FEDERATION_SERVER_CONF = '/path/to/config/file'
const federationServer = new FederationServer()

// You can also give configuration directly
const federationServer = new FederationServer(config)

const app = express()

federationServer.ready.then( () => {
  app.use(federationServer.routes)
  app.listen(3000)
})
```

## Configuration file

Configuration file is a JSON file. The default values are
in [src/config.json](./src/config.json).

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
