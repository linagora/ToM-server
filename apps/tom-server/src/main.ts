import { resolve } from "node:path";

import type { Express } from "express";
import type { Logger } from "winston";

import { createApp } from "./app";
import { loadConfig } from "./config/index";
import type { Config } from "./config/types";
import { loadMessages } from "./i18n/index";
import { createLogger } from "./logger/index";

const configPath: string | undefined = process.argv.includes("--config")
  ? process.argv[process.argv.indexOf("--config") + 1]
  : undefined;

const config: Config = loadConfig(configPath);
const logger: Logger = createLogger(config.logger);

loadMessages(resolve(config.i18n.localesPath), logger.child({ module: "i18n" }));

const app: Express = createApp(config, logger);

app.listen(config.port, config.host, () => {
  logger.info(`tom listening on ${config.host}:${config.port}`);
});
