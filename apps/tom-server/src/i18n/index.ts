import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import yaml from "js-yaml";
import type { Logger } from "winston";

import { MessagesDirNotFoundError } from "./errors";

type MessageDict = Record<string, string>;
const dictionaries: Map<string, MessageDict> = new Map<string, MessageDict>();

export function loadMessages(messagesDir: string, logger: Logger): boolean {
  logger.debug(`Loading messages from ${messagesDir}`);
  if (!existsSync(messagesDir)) {
    throw new MessagesDirNotFoundError(messagesDir);
  }

  const files = readdirSync(messagesDir).filter((f) => f.endsWith(".yaml"));
  if (files.length === 0) {
    logger.error(`No .yaml files found in ${messagesDir}`);
    return false;
  }

  for (const file of files) {
    const filePath = resolve(messagesDir, file);
    logger.debug(`Loading messages from ${filePath}`);

    const locale = file.replace(".yaml", "");
    const raw = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw) as MessageDict;

    dictionaries.set(locale, parsed);
    logger.info(`Loaded ${Object.keys(parsed).length} messages for locale ${locale}`);
  }

  return true;
}

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ? String(vars[key]) : `{{${key}}}`;
  });
}

export function resolveMessage(locale: string, code: string, context: Record<string, unknown> = {}): string {
  // Try exact locale, then base language (e.g., "fr" from "fr-FR"), then fallback
  const baseLocale = locale.split("-")[0];
  const dict = dictionaries.get(locale) ?? dictionaries.get(baseLocale) ?? dictionaries.get("en");

  const template = dict?.[code] ?? code;
  return interpolate(template, context);
}
