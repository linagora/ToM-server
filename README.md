# Twake-Chat server repository

This is a multi-packages repository. See [packages](./packages) directory.

REST API Endpoints documentation is available on https://linagora.github.io/ToM-server/

[Try it with docker](./docker.md)

## Scripts

* `npm run build`: build all packages
* `npm run test`: test all packages

## Modules

* [@twake/matrix-identity-server](./packages/matrix-identity-server):
  [Matrix Identity Service](https://spec.matrix.org/v1.6/identity-service-api/) implementation for Node.js
* [@twake/matrix-invite](./packages/matrix-invite): matrix invitation web application
* [@twake/server](./packages/tom-server): the main Twake Chat Server, extends [@twake/matrix-identity-server](./packages/matrix-identity-server)
* [@twake/federated-identity-service](./packages/federated-identity-service): Twake Federated Identity Service
* [@twake/config-parser](./packages/config-parser): simple file parser that uses also environment variables
* [@twake/crypto](./packages/crypto): cryptographic methods for Twake Chat
* [@twake/logger](./packages/logger): logger for Twake
* [@twake/matrix-application-server](./packages/matrix-application-server): implements
  [Matrix Application Service API](https://spec.matrix.org/v1.6/application-service-api/)
* [matrix-resolve](./packages/matrix-resolve): resolve a Matrix "server name" into base URL following
  [Matrix specification](https://spec.matrix.org/latest/server-server-api/#server-discovery)
* [@twake/retry-promise](packages/retry-promise): simple module extending javascript Promise with retry strategy

## Twake-Chat docker

This repository provides a docker image. Here are the environment variables:

* Required:
  * `BASE_URL`: Public URL
  * Database:
    * `DATABASE_ENGINE` _(`pg` or `sqlite`)_
    * `DATABASE_HOST` _(path for `sqlite`)_
    * `DATABASE_NAME`
    * `DATABASE_USER`
    * `DATABASE_PASSWORD`
    * `DATABASE_SSL`
  * `OIDC_ISSUER`: URL of SSO server
  * LDAP service:
    * `LDAP_BASE`
    * `LDAP_FILTER`
    * `LDAP_USER`
    * `LDAP_PASSWORD`
    * `LDAP_URI`
  * Matrix server:
    * `SERVER_NAME` _(same value than in Matrix's homeserver.yaml)_
    * `MATRIX_SERVER` _(real Matrix server)_
  * `TEMPLATE_DIR` _(default: `node_modules/@twake/server/templates`)_
* Recommended:
  * `ADDITIONAL_FEATURES`: set true to have all search features; false for a public instance
  * Cron service:
    * `CRON_SERVICE` _(default: true)_: enable cron tasks
    * `UPDATE_USERS_CRON` _(default: `*/15 * * * *`)_
    * `UPDATE_FEDERATED_IDENTITY_HASHES_CRON` _(default: `3 3 * * *`)_
  * Logs:
    * `LOG_TRANSPORTS`: set to `Console`
  * `TRUSTED_PROXIES`: IP list of server allowed to set `X-Frowarded-For` header
  * Rate limits _(see [express-rate-limit](https://www.npmjs.com/package/express-rate-limit))_:
    * `RATE_LIMITING_WINDOW`
    * `RATE_LIMITING_NB_REQUESTS`
* Optional:
  * `FEDERATED_IDENTITY_SERVICES`: list of federated identity services
  * Use a CrowdSec service:
    * `CROWDSEC_URI`
    * `CROWDSEC_KEY`
  * Add Jitsi into metadata:
    * `JITSI_BASE_URL`
    * `JITSI_JWT_ALGORITHM`
    * `JITSI_JWT_ISSUER`
    * `JITSI_SECRET`
    * `JITSI_PREFERRED_DOMAIN`
    * `JITSI_USE_JWT`
  * Matrix database _(for automatic channels)_:
    * `MATRIX_DATABASE_ENGINE`
    * `MATRIX_DATABASE_HOST`
    * `MATRIX_DATABASE_NAME`
    * `MATRIX_DATABASE_PASSWORD`
    * `MATRIX_DATABASE_SSL`
    * `MATRIX_DATABASE_USER`
  * Opensearch features:
    * `OPENSEARCH_CA_CERT_PATH`
    * `OPENSEARCH_HOST`
    * `OPENSEARCH_IS_ACTIVATED`
    * `OPENSEARCH_MAX_RETRIES`
    * `OPENSEARCH_NUMBER_OF_SHARDS`
    * `OPENSEARCH_NUMBER_OF_REPLICAS`
    * `OPENSEARCH_PASSWORD`
    * `OPENSEARCH_SSL`
    * `OPENSEARCH_USER`
    * `OPENSEARCH_WAIT_FOR_ACTIVE_SHARDS`

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE)
