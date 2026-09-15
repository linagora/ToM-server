import type { z } from "zod";

import type { wellKnownClientDocumentSchema, wellKnownClientSettingsSchema } from "./schema";

export type WellKnownClientSettings = z.infer<typeof wellKnownClientSettingsSchema>;
export type WellKnownClientDocument = z.infer<typeof wellKnownClientDocumentSchema>;
