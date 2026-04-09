import { resolve } from "node:path";

import { z } from "zod";

const DEFAULT_LOCALE = "en";

const defaultPath = (): string => {
  const prefix = process.platform === "win32" ? (process.env.PROGRAMDATA ?? "C:\\ProgramData") : "/usr/share";

  return resolve(prefix, "twake", "chat", "tom", "i18n");
};

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const i18nConfigSchema = z.object({
  i18n: z
    .object({
      locale: z.string(),
      localesPath: z.string(),
    })
    .default({ locale: DEFAULT_LOCALE, localesPath: defaultPath() }),
});
