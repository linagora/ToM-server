import { z } from "zod";

import { loggerConfigSchema } from "../logger/schema";

const DEFAULT_HOST: string = "0.0.0.0";
const DEFAULT_PORT: number = 3000;

const MIN_ALLOWED_PORT: number = 1;
const MAX_ALLOWED_PORT: number = 65535;

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const serverConfigSchema = z.object({
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().min(MIN_ALLOWED_PORT).max(MAX_ALLOWED_PORT).default(DEFAULT_PORT),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const configSchema = z.object({
  ...serverConfigSchema.shape,
  ...loggerConfigSchema.shape,
});
