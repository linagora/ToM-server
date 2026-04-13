/**
 * Platform-aware base directory resolution.
 *
 * Exports two functions that return ordered directory lists.
 * Modules resolve their own filenames relative to these directories.
 *
 * Default order: system → shared → user (widest → narrowest).
 * Invert for "nearest wins" lookups (assets, i18n).
 *
 * Platform conventions:
 *   Linux:   /etc, /usr/local/etc, XDG_CONFIG_HOME
 *             /usr/share, /usr/local/share, XDG_DATA_HOME
 *   Windows: PROGRAMDATA, APPDATA, LOCALAPPDATA
 */
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const APP_DIR: string = join("twake", "chat", "tom");
const isWindows: boolean = process.platform === "win32";

import { z } from "zod";

const winBaseDirs: string[] = [
  process.env.PROGRAMDATA ?? "C:\\ProgramData",
  process.env.APPDATA ?? resolve(homedir(), "AppData", "Roaming"),
  process.env.LOCALAPPDATA ?? resolve(homedir(), "AppData", "Local"),
];

const linuxConfigBaseDirs: string[] = [
  "/etc",
  "/usr/local/etc",
  process.env.XDG_CONFIG_HOME ?? resolve(homedir(), ".config"),
];

const linuxShareBaseDirs: string[] = [
  "/usr/share",
  "/usr/local/share",
  process.env.XDG_DATA_HOME ?? resolve(homedir(), ".local", "share"),
];

const baseConfigDirs: string[] = isWindows ? winBaseDirs : linuxConfigBaseDirs;
const baseShareDirs: string[] = isWindows ? winBaseDirs : linuxShareBaseDirs;

const configDirs: string[] = baseConfigDirs.map((dir) => resolve(dir, APP_DIR));
const shareDirs: string[] = baseShareDirs.map((dir) => resolve(dir, APP_DIR));

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const searchOptionsSchema = z.object({
  invert: z.boolean().default(false),
  includeCwd: z.boolean().default(false),
});

export type SearchOptions = z.infer<typeof searchOptionsSchema>;

function applyOptions(dirs: string[], options?: SearchOptions): string[] {
  const result = [...dirs];
  if (options?.includeCwd === true) {
    result.push(process.cwd());
  }
  if (options?.invert === true) {
    result.reverse();
  }
  return result;
}

/** Config directory tiers. Default: system → shared → user. */
export function getConfigDirs(options?: SearchOptions): string[] {
  return applyOptions(configDirs, options);
}

/** Share/data directory tiers. Default: system → shared → user. */
export function getShareDirs(options?: SearchOptions): string[] {
  return applyOptions(shareDirs, options);
}
