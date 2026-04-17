import { telemetrySettingsSchema } from "../telemetry/schema";

import { z } from "zod";

import { i18nSettingsSchema } from "../i18n/schema";
import { loggerSettingsSchema } from "../logger/schema";
import { landingSettingsSchema } from "../modules/landing/schema";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;
const MIN_ALLOWED_PORT = 1;
const MAX_ALLOWED_PORT = 65535;
const DEFAULT_TRUST_X_FORWARDED_FOR = false;

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

const DEFAULT_DB_SSL = false;
const DEFAULT_DB_VACUUM_DELAY = 3600;

const DEFAULT_HASH_RATE_LIMIT = 100;
const DEFAULT_HASH_KEY_DELAY = 3600;
const DEFAULT_HASH_KEYS_DEPTH = 3;
const DEFAULT_HASH_PEPPER_CRON = "0 0 * * *";

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SENDER_LOCALPART = "tom";
const DEFAULT_LINK_EXPIRY = 3600;

const DEFAULT_LDAP_UID_FIELD = "uid";
const DEFAULT_LDAP_SYNC_CRON = "0 */4 * * *";

const DEFAULT_CACHE_ENGINE = "memory";
const DEFAULT_CACHE_TTL = 3600;

const DEFAULT_SMS_API_URL = "https://api.octopush.com/v1/public";

const DEFAULT_FEDERATION_SYNC_CRON = "0 */6 * * *";

const DEFAULT_JWT_ALGORITHM = "HS256";

const DEFAULT_TWAKE_CHAT_APP_NAME = "Twake Chat";
const DEFAULT_TWAKE_CHAT_MAX_AVATAR_SIZE = "10485760";

const DEFAULT_VISIBILITY = "private";

const DEFAULT_CREATEROOM_PROXY_ENABLED = false;
const DEFAULT_CREATEROOM_PROXY_MAX_RETRIES = 3;
const DEFAULT_CREATEROOM_PROXY_NUKE_ROOM = true;
const DEFAULT_CREATEROOM_PROXY_DEFAULT_PRESET = "private_chat";
const DEFAULT_CREATEROOM_PROXY_ENCRYPTION = "allowed" as const;

const DEFAULT_CREATEROOM_PROXY_IS_DIRECT_MASK = {
  ban: 100,
  invite: 100,
  kick: 100,
  redact: 100,
  state_default: 100,
  users_default: 10,
  creator_becomes: 10,
};

// biome-ignore lint/nursery/useExplicitType: Specific type for a default value, disregard
const DEFAULT_CREATEROOM_PROXY_PRESETS = [
  {
    name: "trusted_private_chat",
    default_visibility: "private" as "private",
    allow_is_direct: true,
    users_default: 10,
    events_default: 10,
    invite: 10,
    state_default: 100,
    kick: 10,
    ban: 10,
    redact: 10,
    creator_becomes: 10,
    notifications: { room: 10 },
    events: {
      "m.reaction": 10,
      "m.room.redaction": 10,
      "m.room.pinned_events": 10,
      "org.matrix.msc3401.call": 10,
      "org.matrix.msc3401.call.member": 10,
      "m.room.name": 10,
      "m.room.topic": 10,
      "m.room.avatar": 10,
      "m.room.server_acl": 10,
      "m.room.tombstone": 10,
      "m.room.history_visibility": 10,
      "m.room.power_levels": 10,
      "m.room.encryption": 10,
    },
  },
  {
    name: "private_chat",
    default_visibility: "private" as "private",
    allow_is_direct: true,
    users_default: 10,
    events_default: 10,
    invite: 10,
    state_default: 90,
    kick: 50,
    ban: 50,
    redact: 50,
    creator_becomes: 90,
    notifications: { room: 10 },
    events: {
      "m.reaction": 10,
      "m.room.redaction": 10,
      "m.room.pinned_events": 10,
      "org.matrix.msc3401.call": 10,
      "org.matrix.msc3401.call.member": 10,
      "m.room.name": 80,
      "m.room.topic": 80,
      "m.room.avatar": 80,
      "m.room.server_acl": 80,
      "m.room.tombstone": 80,
      "m.room.history_visibility": 80,
      "m.room.power_levels": 80,
      "m.room.encryption": 90,
    },
  },
  {
    name: "public_chat",
    default_visibility: "public" as "public",
    allow_is_direct: false,
    users_default: 10,
    events_default: 10,
    invite: 0,
    state_default: 90,
    kick: 50,
    ban: 50,
    redact: 50,
    creator_becomes: 90,
    notifications: { room: 10 },
    events: {
      "m.reaction": 10,
      "m.room.redaction": 10,
      "m.room.pinned_events": 50,
      "org.matrix.msc3401.call": 50,
      "org.matrix.msc3401.call.member": 10,
      "m.room.name": 80,
      "m.room.topic": 80,
      "m.room.avatar": 80,
      "m.room.server_acl": 80,
      "m.room.tombstone": 80,
      "m.room.history_visibility": 80,
      "m.room.power_levels": 80,
      "m.room.encryption": 100,
    },
  },
  {
    name: "private_channel",
    synapse_preset: "private_chat",
    default_visibility: "private" as "private",
    allow_is_direct: false,
    users_default: 10,
    events_default: 80,
    invite: 50,
    state_default: 90,
    kick: 50,
    ban: 50,
    redact: 80,
    creator_becomes: 90,
    notifications: { room: 80 },
    events: {
      "m.reaction": 10,
      "m.room.redaction": 80,
      "m.room.pinned_events": 50,
      "org.matrix.msc3401.call": 100,
      "org.matrix.msc3401.call.member": 100,
      "m.room.name": 80,
      "m.room.topic": 80,
      "m.room.avatar": 80,
      "m.room.server_acl": 80,
      "m.room.tombstone": 80,
      "m.room.history_visibility": 90,
      "m.room.power_levels": 50,
      "m.room.encryption": 90,
    },
  },
  {
    name: "public_channel",
    synapse_preset: "public_chat",
    default_visibility: "public" as "public",
    allow_is_direct: false,
    users_default: 10,
    events_default: 80,
    invite: 0,
    state_default: 90,
    kick: 50,
    ban: 50,
    redact: 80,
    creator_becomes: 90,
    notifications: { room: 80 },
    events: {
      "m.reaction": 10,
      "m.room.redaction": 80,
      "m.room.pinned_events": 50,
      "org.matrix.msc3401.call": 100,
      "org.matrix.msc3401.call.member": 100,
      "m.room.name": 80,
      "m.room.topic": 80,
      "m.room.avatar": 80,
      "m.room.server_acl": 80,
      "m.room.tombstone": 80,
      "m.room.history_visibility": 100,
      "m.room.power_levels": 50,
      "m.room.encryption": 100,
    },
  },
];

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const databaseSettingsSchema = z.object({
  host: z.string(),
  name: z.string(),
  user: z.string(),
  password: z.string(),
  ssl: z.boolean().default(DEFAULT_DB_SSL),
  vacuum_delay: z.number().default(DEFAULT_DB_VACUUM_DELAY),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const rateLimitingSchema = z.object({
  window_ms: z.number().default(DEFAULT_RATE_LIMIT_WINDOW_MS),
  max_requests: z.number().default(DEFAULT_RATE_LIMIT_MAX_REQUESTS),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const synapseAdminSchema = z.object({
  login: z.string(),
  password: z.string(),
  access_token: z.string().default(""),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const commonSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  application_url: z.string().default(""),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const defaultVisibilitySettingsSchema = z.object({
  visibility: z.string().default(DEFAULT_VISIBILITY),
  visible_fields: z.array(z.string()).default([]),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const userProfileSchema = z.object({
  default_visibility_settings: defaultVisibilitySettingsSchema.prefault({}),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const userDirectorySchema = z.object({
  enabled: z.boolean().default(false),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const createroomProxyFailureSchema = z.object({
  max_retries: z.number().default(DEFAULT_CREATEROOM_PROXY_MAX_RETRIES),
  nuke_room: z.boolean().default(DEFAULT_CREATEROOM_PROXY_NUKE_ROOM),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const directChatMaskSchema = z.object({
  ban: z.number().optional(),
  invite: z.number().optional(),
  kick: z.number().optional(),
  redact: z.number().optional(),
  state_default: z.number().optional(),
  users_default: z.number().optional(),
  creator_becomes: z.number().optional(),
  events: z.record(z.string(), z.number()).optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const presetConfigSchema = z.object({
  name: z.string(),
  users_default: z.number().default(0),
  events_default: z.number().default(0),
  invite: z.number().default(0),
  state_default: z.number().default(50),
  kick: z.number().default(50),
  ban: z.number().default(50),
  redact: z.number().default(50),
  notifications: z.object({ room: z.number() }).default({ room: 20 }),
  events: z.record(z.string(), z.number()).default({}),
  users: z.record(z.string(), z.number()).optional(),
  creator_becomes: z.number().optional(),
  synapse_preset: z.string().optional(),
  default_visibility: z.enum(["public", "private"]).optional(),
  allow_is_direct: z.boolean().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const createroomProxySchema = z.object({
  enabled: z.boolean().default(DEFAULT_CREATEROOM_PROXY_ENABLED),
  on_failure: createroomProxyFailureSchema.prefault({}),
  default_preset: z.string().default(DEFAULT_CREATEROOM_PROXY_DEFAULT_PRESET),
  encryption: z.enum(["allowed", "enforced", "disabled"]).default(DEFAULT_CREATEROOM_PROXY_ENCRYPTION),
  is_direct_mask: directChatMaskSchema.default(DEFAULT_CREATEROOM_PROXY_IS_DIRECT_MASK),
  presets: z.array(presetConfigSchema).default(DEFAULT_CREATEROOM_PROXY_PRESETS),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const serverSettingsSchema = z.object({
  name: z.string(), // REQUIRED
  base_url: z.string().default(""),
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().min(MIN_ALLOWED_PORT).max(MAX_ALLOWED_PORT).default(DEFAULT_PORT),
  trust_x_forwarded_for: z.boolean().default(DEFAULT_TRUST_X_FORWARDED_FOR),
  trusted_proxies: z.array(z.string()).default([]),
  additional_features: z.boolean().default(false),
  enable_cron_jobs: z.boolean().default(false),
  rate_limiting: rateLimitingSchema.prefault({}),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const urlsSettingsSchema = z.object({
  signup: z.string().default(""),
  chat: z.string().default(""),
  auth: z.string().default(""),
  qr_code: z.string().default(""),
  invitation_redirect: z.string().default(""),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const synapseSettingsSchema = z.object({
  server_url: z.url(), // REQUIRED
  internal_host: z.url(), // REQUIRED
  admin: synapseAdminSchema, // REQUIRED
  database: databaseSettingsSchema, // REQUIRED
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const hashSettingsSchema = z.object({
  rate_limit: z.number().default(DEFAULT_HASH_RATE_LIMIT),
  key_delay: z.number().default(DEFAULT_HASH_KEY_DELAY),
  keys_depth: z.number().default(DEFAULT_HASH_KEYS_DEPTH),
  pepper_cron: z.string().default(DEFAULT_HASH_PEPPER_CRON),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const invitationsSettingsSchema = z.object({
  server_name: z.string().default(""),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const termsSettingsSchema = z.object({
  policies: z.record(z.string(), z.unknown()).optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const emailSettingsSchema = z.object({
  smtp_host: z.string(), // REQUIRED
  smtp_port: z.number().int().default(DEFAULT_SMTP_PORT),
  tls: z.boolean().default(true),
  username: z.string().optional(),
  password: z.string().optional(),
  sender: z.string().optional(),
  sender_localpart: z.string().default(DEFAULT_SENDER_LOCALPART),
  verify_certificate: z.boolean().default(true),
  templates_dir: z.string().default(""),
  link_expiry: z.number().default(DEFAULT_LINK_EXPIRY),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const ldapSettingsSchema = z.object({
  uri: z.string().optional(),
  base: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  filter: z.string().optional(),
  uid_field: z.string().default(DEFAULT_LDAP_UID_FIELD),
  sync_cron: z.string().default(DEFAULT_LDAP_SYNC_CRON),
  client_options: z.record(z.string(), z.unknown()).optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const cacheSettingsSchema = z.object({
  engine: z.enum(["memory", "redis"]).default(DEFAULT_CACHE_ENGINE as "memory" | "redis"),
  ttl: z.number().default(DEFAULT_CACHE_TTL),
  redis_uri: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const smsSettingsSchema = z.object({
  api_url: z.url().default(DEFAULT_SMS_API_URL),
  api_login: z.string().optional(),
  api_key: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const federationSettingsSchema = z.object({
  is_federated_identity_service: z.boolean().default(false),
  trusted_servers_addresses: z.array(z.string()).default([]),
  identity_services: z.array(z.string()).default([]),
  sync_cron: z.string().default(DEFAULT_FEDERATION_SYNC_CRON),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const jitsiSettingsSchema = z.object({
  base_url: z.string().default(""),
  use_jwt: z.boolean().default(false),
  jwt_secret: z.string().optional(),
  jwt_issuer: z.string().optional(),
  jwt_algorithm: z.string().default(DEFAULT_JWT_ALGORITHM),
  preferred_domain: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const oidcSettingsSchema = z.object({
  issuer: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const twakeChatSettingsSchema = z.object({
  application_name: z.string().default(DEFAULT_TWAKE_CHAT_APP_NAME),
  application_welcome_message: z.string().default(""),
  privacy_url: z.string().default(""),
  render_html: z.boolean().default(false),
  hide_redacted_events: z.boolean().default(false),
  hide_unknown_events: z.boolean().default(false),
  issue_id: z.string().default(""),
  registration_url: z.string().default(""),
  twake_workplace_homeserver: z.string().default(""),
  app_grid_dashboard_available: z.boolean().default(false),
  platform: z.string().default(""),
  default_max_upload_avatar_size_in_bytes: z.string().default(DEFAULT_TWAKE_CHAT_MAX_AVATAR_SIZE),
  dev_mode: z.boolean().default(false),
  qr_code_download_url: z.string().default(""),
  enable_logs: z.boolean().default(false),
  support_url: z.string().default(""),
  enable_invitations: z.boolean().default(false),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const featuresSettingsSchema = z.object({
  common_settings: commonSettingsSchema.prefault({}),
  matrix_profile_updates_allowed: z.boolean().default(false),
  user_profile: userProfileSchema.prefault({}),
  user_directory: userDirectorySchema.prefault({}),
  createroom_proxy: createroomProxySchema.optional(),
});

// Required modules (No prefault!)
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const serverConfigSchema = z.object({ server: serverSettingsSchema });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const synapseConfigSchema = z.object({ synapse: synapseSettingsSchema });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const databaseConfigSchema = z.object({ database: databaseSettingsSchema });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const emailConfigSchema = z.object({ email: emailSettingsSchema });

// Optional modules (Prefault passes empty object down)
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const urlsConfigSchema = z.object({ urls: urlsSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const hashConfigSchema = z.object({ hash: hashSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const invitationsConfigSchema = z.object({
  invitations: invitationsSettingsSchema.prefault({}),
});
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const termsConfigSchema = z.object({ terms: termsSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const ldapConfigSchema = z.object({ ldap: ldapSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const cacheConfigSchema = z.object({ cache: cacheSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const smsConfigSchema = z.object({ sms: smsSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const federationConfigSchema = z.object({
  federation: federationSettingsSchema.prefault({}),
});
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const jitsiConfigSchema = z.object({ jitsi: jitsiSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const oidcConfigSchema = z.object({ oidc: oidcSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const twakeChatConfigSchema = z.object({
  twake_chat: twakeChatSettingsSchema.prefault({}),
});
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const featuresConfigSchema = z.object({
  features: featuresSettingsSchema.prefault({}),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const loggerConfigSchema = z.object({
  logger: loggerSettingsSchema.prefault({}),
});
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const i18nConfigSchema = z.object({ i18n: i18nSettingsSchema.prefault({}) });
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const landingConfigSchema = z.object({
  landing: landingSettingsSchema.prefault({}),
});
// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const telemetryConfigSchema = z.object({
  telemetry: telemetrySettingsSchema.prefault({}),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const configSchema = z.object({
  ...serverConfigSchema.shape,
  ...urlsConfigSchema.shape,
  ...synapseConfigSchema.shape,
  ...databaseConfigSchema.shape,
  ...hashConfigSchema.shape,
  ...invitationsConfigSchema.shape,
  ...termsConfigSchema.shape,
  ...emailConfigSchema.shape,
  ...ldapConfigSchema.shape,
  ...cacheConfigSchema.shape,
  ...smsConfigSchema.shape,
  ...federationConfigSchema.shape,
  ...jitsiConfigSchema.shape,
  ...oidcConfigSchema.shape,
  ...twakeChatConfigSchema.shape,
  ...featuresConfigSchema.shape,

  ...loggerConfigSchema.shape,
  ...i18nConfigSchema.shape,
  ...landingConfigSchema.shape,
  ...telemetryConfigSchema.shape,
});
