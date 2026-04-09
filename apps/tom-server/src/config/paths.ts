import { homedir } from "node:os";
import { join, resolve } from "node:path";

const CONFIG_FILEPATH: string = join("twake", "chat", "tom", "config.yaml");
const LOCAL_CONFIG_FILENAME: string = ".tomconfig.yaml";

export function getConfigPaths(): string[] {
  const basePaths: string[] =
    process.platform === "win32"
      ? [process.env.PROGRAMDATA ?? "C:\\ProgramData", process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")]
      : ["/etc", process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")];

  return [...basePaths.map((base) => resolve(base, CONFIG_FILEPATH)), resolve(process.cwd(), LOCAL_CONFIG_FILENAME)];
}
