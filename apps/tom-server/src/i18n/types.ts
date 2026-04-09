import type { z } from "zod";

import type { i18nConfigSchema } from "./schema";

export type I18nConfig = z.infer<typeof i18nConfigSchema>["i18n"];
