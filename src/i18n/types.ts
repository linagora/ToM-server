import type { z } from "zod";

import type { i18nSettingsSchema } from "./schema";

export type I18nConfig = z.infer<typeof i18nSettingsSchema>;
