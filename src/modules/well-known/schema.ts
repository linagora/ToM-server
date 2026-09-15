import { z } from "zod";

const wellKnownHomeserverSchema = z.object({
  base_url: z.url({
    normalize: true,
  }),
});

const wellKnownIdentityServerSchema = z.object({
  base_url: z.url({
    normalize: true,
  }),
});

const wellKnownTomServerSchema = z.object({
  base_url: z.url({
    normalize: true,
  }),
  server_name: z.string(),
});

const wellKnownFederatedIdentityServicesSchema = z.object({
  base_urls: z.array(
    z.url({
      normalize: true,
    }),
  ),
});

export const wellKnownClientSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  extra: z.record(z.string(), z.unknown()).default({}).optional(),

  homeserver: wellKnownHomeserverSchema.optional(),
  identityserver: wellKnownIdentityServerSchema.optional(),
  tomserver: wellKnownTomServerSchema.optional(),
  federatedIdentityServices: wellKnownFederatedIdentityServicesSchema.optional(),
});

export const wellKnownSettingsSchema = z.object({
  client: wellKnownClientSettingsSchema
    .pick({
      enabled: true,
      extra: true,
    })
    .prefault({}),
});

export const wellKnownClientDocumentSchema = z
  .object({
    "m.homeserver": wellKnownHomeserverSchema.optional(),
    "m.identity_server": wellKnownIdentityServerSchema.optional(),
    "t.server": wellKnownTomServerSchema.optional(),
    "m.federated_identity_services": wellKnownFederatedIdentityServicesSchema.optional(),
  })
  .catchall(z.unknown());
