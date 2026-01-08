# @twake/tom-server

Node.js library that implements a Twake-on-Matrix server.

## Synopsis

Example using [express](https://www.npmjs.com/package/express):

```js
import express from 'express';
import TwakeServer from '@twake/server';

// if configuration is in default file (/etc/twake/server.conf)
const twakeServer = new TwakeServer();

// else if configuration is in a different file, set TWAKE_SERVER_CONF
process.env.TWAKE_SERVER_CONF = '/path/to/config/file';
const twakeServer = new TwakeVaultAPI();

// You can also give configuration directly
const twakeServer = new TwakeVaultAPI(config);

const app = express();

twakeServer.ready
  .then(() => {
    app.use(twakeServer.endpoints);
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000;
    console.log(`Listening on port ${port}`);
    app.listen(port);
  })
  .catch((e) => {
    throw e;
  });
```

## Configuration file

Configuration file is a JSON file. The default values are in [src/config.json](./src/config.json).

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
