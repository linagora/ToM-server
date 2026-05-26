import express from "express";

import FederatedIdentityService from "@twake/federated-identity-service";

const federatedIdentityService = new FederatedIdentityService({
  database_host: ":memory:",
});

const app = express();

federatedIdentityService.ready
  .then(() => {
    app.use(federatedIdentityService.routes);
    const port = process.argv[2] !== undefined ? parseInt(process.argv[2], 10) : 3000;
    // biome-ignore lint/suspicious/noConsole: example script intentionally logs to stdout
    console.log(`Listening on port ${port}`);
    app.listen(port);
  })
  .catch((e) => {
    throw e;
  });
