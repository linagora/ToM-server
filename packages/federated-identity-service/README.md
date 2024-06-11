# @twake/federated-identity-service

Node.js library that implements
[Matrix Identity Service API](https://spec.matrix.org/v1.6/identity-service-api/) and [this proposal](https://github.com/guimard/matrix-spec-proposals/blob/unified-identity-service/proposals/4004-unified-identity-service-view.md)

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express'
import FederatedIdentityService from '@twake/federated-identity-service'

// if configuration is in default file (/etc/twake/federated-identity-service.conf)
const federatedIdentityService = new FederatedIdentityService()

// else if configuration is in a different file, set TWAKE_FEDERATED_IDENTITY_SERVICE_CONF
process.env.TWAKE_FEDERATED_IDENTITY_SERVICE_CONF = '/path/to/config/file'
const federatedIdentityService = new FederatedIdentityService()

// You can also give configuration directly
const federatedIdentityService = new FederatedIdentityService(config)

const app = express()

federatedIdentityService.ready.then( () => {
  app.use(federatedIdentityService.routes)
  app.listen(3000)
})
```

## Configuration file

Configuration file is a JSON file. The default values are
in [src/config.json](./src/config.json).

## How to use it with a client

Sending requests to the federated identity service requires to be logged on this server. The token allowing to send requests to Tom-server does not work with the federated identity service.

After the user signed in, the client has to send a GET request to `/.well-known/matrix/client` endpoint or `/.well-known/twake/client` endpoint. If the response body contains the `m.federated_identity_services` key then at least one federated identity service is available. Keep the value of the `base_urls` field that you will find inside the `m.federated_identity_services` object.

These are the steps to obtain a token that works on the federated identity service:
1. Send a POST request to the URL `https://<matrix_server_address>/_matrix/client/v3/user/<userId>/openid/request_token`, you have to replace `matrix_server_address` by the address of the Matrix server selected by the user, and `userId` by the Matrix id of the user. The request body has to be empty and you have to set the `Authorization` header with the value `Bearer <user_matrix_token>` where `user_matrix_token` is the token retrieved on sign in. For more details see [Matrix specification](https://spec.matrix.org/v1.8/client-server-api/#post_matrixclientv3useruseridopenidrequest_token). **NB**: The `access_token` given in response can be used to register into any Matrix identity service or to ask for a Token exchange into a [yadd/lemonldap-ng-portal](https://github.com/guimard/llng-docker) server
2. The response body of the previous request now should be sent to the URL `https://<federated_identity_service>/_matrix/identity/v2/account/register`. `federated_identity_service` has to be replaced by each federated identity service address retrieved in the response body of the request sent on the first step. One request by federated identity service. The `Authorization` header does not need to be set. If the request does not work, maybe the value of  `matrix_server_name` in the body is not the good one.
For more details see [Matrix specification](https://spec.matrix.org/v1.8/identity-service-api/#post_matrixidentityv2accountregister)
   * The response body JSON of each request will contain a `token` field whose the value will allow to be authenticated on the matching federated identity service.

## Docker

**Federation Identity Service** is available on [Docker](https://hub.docker.com/).
You can configure it using environment variables:

* Required parameters:
  * `TRUSTED_SERVERS_ADDRESSES`: the space separated list of Tom-Servers allowed
    to push data. Networks or IP addresses
  * `BASE_URL`; the public URL of this service _(example: https://fed-id-service.example.com/)_
  * `DATABASE_ENGINE` _(`sqlite` or `pg`)_, `DATABASE_HOST`, `DATABASE_NAME`,
    `DATABASE_USER`, `DATABASE_PASSWORD`: the database parameters
* Optional parameters:
  * `CRON_SERVICE` _(true/false)_: enable ot disable cron tasks. It is required
    to have at least one active federated-odentity-service with `CRON_SERVICE`
    active per database
  * Logs:
    * `LOG_TRANSPORTS`: set to `Console`
    * `LOG_LEVEL`: default to "error", possible values: "error", "warn", "info", "http", "verbose", "debug", "silly"

A federation server is also a [Matrix Identity Service](matrix-identity-server/README.md),
thus all parameters of this service can also be enabled but this is interseting
only if this instance is also used as ToM-Server.

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
