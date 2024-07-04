# Twake Matrix extension server

<br />
<div align="center">
  <a href="https://github.com/linagora/twake-on-matrix">
    <img src="https://github.com/artembru/ToM-server/assets/146178981/4a5da817-466f-4d4a-8804-3881b672bc42">
  </a>




  <p align="center">
    <a href="https://twake-chat.com">Website</a>
    •
    <a href="https://beta.twake.app/web/#/rooms">View Demo</a>
    •
    <a href="https://github.com/linagora/twake-on-matrix/issues">Report Bug</a>
    •
    <a href="https://hosted.weblate.org/projects/linagora/twake-matrix/#repository">Translate Twake></a>
</p>
</div>

---

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
* [@twakeg/federation-server](./packages/federation-server): Twake Federation Server
* [@twake/config-parser](./packages/config-parser): simple file parser that uses also environment variables
* [@twake/crypto](./packages/crypto): cryptographic methods for Twake Chat
* [@twake/logger](./packages/logger): logger for Twake
* [@twake/matrix-application-server](./packages/matrix-application-server): implements
  [Matrix Application Service API](https://spec.matrix.org/v1.6/application-service-api/)
* [matrix-resolve](./packages/matrix-resolve): resolve a Matrix "server name" into base URL following
  [Matrix specification](https://spec.matrix.org/latest/server-server-api/#server-discovery)
* [@twake/retry-promise](packages/retry-promise): simple module extending javascript Promise with retry strategy

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE)
