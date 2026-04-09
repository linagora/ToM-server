import { existsSync, readFileSync } from "node:fs";

import deepmerge from "deepmerge";
import yaml from "js-yaml";

import { getConfigPaths } from "./paths";
import { configSchema } from "./schema";
import type { Config } from "./types";

export function loadConfig(cliPath?: string): Config {
  const paths = getConfigPaths();
  if (cliPath) {
    paths.push(cliPath);
  }

  const layers: Record<string, unknown>[] = [];

  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const raw = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === "object") {
      layers.push(parsed as Record<string, unknown>);
    }
  }

  if (layers.length === 0) {
    throw new Error(`No config files found. Searched:\n${paths.map((p) => `  - ${p}`).join("\n")}`);
  }

  const merged = layers.reduce(
    // biome-ignore lint/nursery/useExplicitType: deepmerge defines arrayMerge as handling any[] types
    (acc, layer) => deepmerge(acc, layer, { arrayMerge: (_target, source) => source }),
    {} as Record<string, unknown>,
  );

  const result = configSchema.safeParse(merged);

  if (!result.success) {
    const formatted = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${formatted}`);
  }

  return result.data;
}
