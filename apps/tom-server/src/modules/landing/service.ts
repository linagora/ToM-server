import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { Logger } from "winston";

import type { LandingConfig } from "./types";

export class LandingService {
  #resolvedPath: string | null;
  #log: Logger;

  constructor(config: LandingConfig, logger: Logger) {
    this.#log = logger.child({ module: "landing" });
    const abs = resolve(config.filePath);

    if (!existsSync(abs)) {
      this.#log.warn("landing page not found, route will not be mounted", { path: abs });
      this.#resolvedPath = null;
    } else {
      this.#log.info("landing page resolved", { path: abs });
      this.#resolvedPath = abs;
    }
  }

  get available(): boolean {
    return !!this.#resolvedPath;
  }

  get filePath(): string | null {
    return this.#resolvedPath;
  }
}
