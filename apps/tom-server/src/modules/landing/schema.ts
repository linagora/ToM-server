import { resolve } from "node:path";

import { z } from "zod";

const defaultPath = (): string => {
  const prefix = process.platform === "win32" ? (process.env.PROGRAMDATA ?? "C:\\ProgramData") : "/usr/share";

  return resolve(prefix, "twake", "chat", "tom", "static", "landing.html");
};

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const landingConfigSchema = z.object({
  landing: z
    .object({
      filePath: z.string(),
    })
    .default({ filePath: defaultPath() }),
});
