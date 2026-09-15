import type { Logger } from "winston";
import type { z } from "zod";

import { DomainError } from "../../errors/domain-error";
import { INTERNAL } from "../../errors/error-codes";
import { wellKnownClientDocumentSchema, wellKnownClientSettingsSchema } from "./schema";
import type { WellKnownClientDocument, WellKnownClientSettings } from "./types";

export class WellKnownClientService {
  #document: WellKnownClientDocument = {};
  #log: Logger;

  constructor(config: WellKnownClientSettings, logger: Logger) {
    this.#log = logger;

    if (!config.enabled) {
      this.#log.info("module is not enabled. skipping service initialization");
      return;
    }

    this.#log.info("well-known matrix client building document...");

    const _parsedConfig = this.#parse(wellKnownClientSettingsSchema, config, "config");
    const _document = this.#buildDocument(_parsedConfig);

    this.#document = this.#parse(wellKnownClientDocumentSchema, _document, "document");
  }

  get document(): WellKnownClientDocument {
    return this.#document;
  }

  #parse<Schema extends z.ZodType>(schema: Schema, value: unknown, label: string): z.infer<Schema> {
    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    this.#log.error(`well-known-client ${label} failed validation`, {
      issues: result.error.issues,
    });

    throw new DomainError(INTERNAL, `well-known-client ${label} failed validation`, {
      label,
      issues: result.error.issues,
    });
  }

  #buildDocument(config: WellKnownClientSettings): WellKnownClientDocument {
    const document: WellKnownClientDocument = {
      ...config.extra,
    };

    if (config.homeserver) {
      document["m.homeserver"] = config.homeserver;
      this.#log.debug(`appending m.homeserver section: ${JSON.stringify(config.homeserver)}`);
    } else {
      this.#log.warn("no homeserver configured");
    }

    if (config.identityserver) {
      document["m.identity_server"] = config.identityserver;
      this.#log.debug(`appending m.identity_server section: ${JSON.stringify(config.identityserver)}`);
    } else {
      this.#log.warn("no identity server configured");
    }

    if (config.tomserver) {
      document["t.server"] = config.tomserver;
      this.#log.debug(`appending t.server section: ${JSON.stringify(config.tomserver)}`);
    } else {
      this.#log.warn("no tom server configured");
    }

    if (config.federatedIdentityServices) {
      document["m.federated_identity_services"] = config.federatedIdentityServices;
      this.#log.debug(
        `appending m.federated_identity_services section: ${JSON.stringify(config.federatedIdentityServices)}`,
      );
    } else {
      this.#log.warn("no federated identity services configured");
    }

    return document;
  }
}
