import type { Express } from "express";
import type { Logger } from "winston";

import { createApp } from "./app";
import { loadConfig } from "./config/index";
import type { Config } from "./config/types";
import { createLogger } from "./logger/index";

const configPath: string | undefined = process.argv.includes("--config")
  ? process.argv[process.argv.indexOf("--config") + 1]
  : undefined;

const config: Config = loadConfig(configPath);
const logger: Logger = createLogger(config.logger);

const app: Express = createApp(config, logger);

const { host, port } = config;
app.listen(port, host, () => {
  logger.info(`tom listening on ${host}:${port}`);
});
