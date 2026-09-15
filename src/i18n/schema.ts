import { z } from "zod";

const DEFAULT_LOCALE = "en";
export const DEFAULT_I18N_DIRNAME = "i18n";

export const i18nSettingsSchema = z.object({
  locale: z.string().default(DEFAULT_LOCALE),
  locales_path: z.string().optional(),
});
