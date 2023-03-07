# @twake/matrix-identity-server

Node.js library that implements
[Matrix Identity Service API](https://spec.matrix.org/v1.6/identity-service-api/).

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express'
import IdServer from '@twake/matrix-identity-server'
const idServer = new IdServer()

const app = express()

Object.keys(idServer.api.get).forEach( k => {
  app.get(k, idServer.api.get[k])
})

Object.keys(idServer.api.post).forEach( k => {
  app.post(k, idServer.api.get[k])
})

app.listen(3000)
```

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
