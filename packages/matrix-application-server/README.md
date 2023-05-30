# @twake/matrix-application-server

Node.js library that implements
[Matrix Application Service API](https://spec.matrix.org/v1.6/application-service-api/).

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express'
import AppServer from '@twake/matrix-application-server'

// if configuration is in default file (/etc/twake/as-server.conf)
const appServer = new AppServer()

// else if configuration is in a different file, set TWAKE_AS_SERVER_CONF
process.env.TWAKE_AS_SERVER_CONF = '/path/to/config/file'
const appServer = new AppServer()

// You can also give configuration directly
const appServer = new AppServer(config)

const app = express()

app.use(appServer.endpoints)
app.listen(3000)
```

This module will be requested by the matrix homeserver each time the homeserver will receive a request intended for a room or a user whose id or alias matches one of the application server namespaces regexes. The matrix-application-server module should be extended to handle event received from matrix homeserver.

See https://github.com/matrix-org/matrix-appservice-bridge for a full complex example

## Configuration file

Configuration file is a JSON file. The default values are
in [src/config.json](./src/config.json).

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
