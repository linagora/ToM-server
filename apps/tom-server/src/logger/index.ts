import winston from "winston";

import type { LoggerConfig } from "./types";

const buildFormats = (pretty: boolean): winston.Logform.Format[] => {
  const formats: winston.Logform.Format[] = [winston.format.timestamp(), winston.format.errors({ stack: true })];

  if (pretty) {
    formats.push(winston.format.colorize(), winston.format.simple());
  } else {
    formats.push(winston.format.json());
  }

  return formats;
};

export function createLogger(config: LoggerConfig): winston.Logger {
  return winston.createLogger({
    level: config.level,
    format: winston.format.combine(...buildFormats(config.pretty)),
    defaultMeta: { service: "tom" },
    transports: [new winston.transports.Console()],
  });
}
