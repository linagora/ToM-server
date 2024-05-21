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

## How to use it with a client

Sending requests to the federation server requires to be logged on this server. The token allowing to send requests to Tom-server does not work with the federation server.

After the user signed in, the client has to send a GET request to `/.well-known/matrix/client` endpoint or `/.well-known/twake/client` endpoint. If the response body contains the `m.federation_servers` key then at least one federation server is available. Keep the value of the `base_urls` field that you will find inside the `m.federation_servers` object.

These are the steps to obtain a token that works on the federation server:
1. Send a POST request to the URL `https://<matrix_server_address>/_matrix/client/v3/user/<userId>/openid/request_token`, you have to replace `matrix_server_address` by the address of the Matrix server selected by the user, and `userId` by the Matrix id of the user. The request body has to be empty and you have to set the `Authorization` header with the value `Bearer <user_matrix_token>` where `user_matrix_token` is the token retrieved on sign in. For more details see [Matrix specification](https://spec.matrix.org/v1.8/client-server-api/#post_matrixclientv3useruseridopenidrequest_token). **NB**: The `access_token` given in response can be used to register into any Matrix identity service or to ask for a Token exchange into a [yadd/lemonldap-ng-portal](https://github.com/guimard/llng-docker) server
2. The response body of the previous request now should be sent to the URL `https://<federation_server>/_matrix/identity/v2/account/register`. `federation_server` has to be replaced by each federation server address retrieved in the response body of the request sent on the first step. One request by federation server. The `Authorization` header does not need to be set. If the request does not work, maybe the value of  `matrix_server_name` in the body is not the good one.
For more details see [Matrix specification](https://spec.matrix.org/v1.8/identity-service-api/#post_matrixidentityv2accountregister)
   * The response body JSON of each request will contain a `token` field whose the value will allow to be authenticated on the matching federation server.

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
