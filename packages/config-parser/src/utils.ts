import type { ConfigDescription, Configuration } from "./types";

/**
 * Parses the configuration using the old parser strategy.
 * @param desc - The configuration description.
 * @param res - The resulting configuration.
 */
export const oldParser = (desc: ConfigDescription, res: Configuration): void => {
  // Parse wanted keys
  Object.keys(desc).forEach((key: string) => {
    // If environment variable exists, it overrides current value
    const envValue = process.env[key.toUpperCase()];
    if (envValue && envValue !== "") {
      const raw = envValue;
      try {
        res[key] = JSON.parse(raw);
      } catch {
        res[key] = raw;
      }
    } else {
      // if default value exists use it
      if ((res[key] === null || res[key] === undefined) && desc[key] !== undefined) {
        res[key] = desc[key];
      }
    }
  });
  // Verify that result as no unwanted keys
  Object.keys(res).forEach((key: string) => {
    if (desc[key] === undefined) {
      throw new Error(`Key ${key} isn't accepted`);
    }
  });
};

export const isTruthy = (value: string | null | undefined): boolean =>
  ["1", "true", "on", "enable", "enabled", "active", "activated"].includes(value?.toLowerCase() ?? "");
