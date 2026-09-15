import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import deepmerge from "deepmerge";
import { load as loadYaml } from "js-yaml";

import { getConfigDirs } from "../platform/paths";
import { configSchema } from "./schema";
import type { Config } from "./types";

const CONFIG_FILENAME = "config.yaml";
const LOCAL_CONFIG_FILENAME = ".tomconfig.yaml";

export function loadConfig(cliPath?: string): Config {
  const dirs = getConfigDirs();
  const paths = dirs.map((dir) => resolve(dir, CONFIG_FILENAME));

  paths.push(resolve(process.cwd(), LOCAL_CONFIG_FILENAME));
  if (cliPath) paths.push(cliPath);

  const layers: Record<string, unknown>[] = [];

  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const raw = readFileSync(filePath, "utf-8");
    const parsed = loadYaml(raw);
    if (parsed && typeof parsed === "object") {
      layers.push(parsed as Record<string, unknown>);
    }
  }

  if (layers.length === 0) {
    throw new Error(`No config files found. Searched:\n${paths.map((p) => `  - ${p}`).join("\n")}`);
  }

  const merged = layers.reduce(
    (acc, layer) =>
      deepmerge(acc, layer, {
        arrayMerge: (_target: unknown[], source: unknown[]) => source,
      }),
    {} as Record<string, unknown>,
  );

  const result = configSchema.safeParse(merged);

  if (!result.success) {
    const formatted = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${formatted}`);
  }

  return result.data;
}
