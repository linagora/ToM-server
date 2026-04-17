// src/legacy/schema.ts
import { z } from "zod";

// ==========================================
// 1. Reusable Sub-schemas
// ==========================================

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const connectionOptionsSchema = z.union([z.boolean(), z.record(z.string(), z.unknown())]);

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const powerLevelEventsSchema = z.object({
  "m.reaction": z.number(),
  "m.room.redaction": z.number(),
  "m.room.pinned_events": z.number(),
  "org.matrix.msc3401.call": z.number(),
  "org.matrix.msc3401.call.member": z.number(),
  "m.room.name": z.number(),
  "m.room.topic": z.number(),
  "m.room.avatar": z.number(),
  "m.room.history_visibility": z.number(),
  "m.room.power_levels": z.number(),
  "m.room.encryption": z.number(),
  "m.room.server_acl": z.number().optional(),
  "m.room.tombstone": z.number().optional(),
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
  events: powerLevelEventsSchema.partial().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const presetConfigSchema = z.object({
  name: z.string(),
  users_default: z.number(),
  events_default: z.number(),
  invite: z.number(),
  state_default: z.number(),
  kick: z.number(),
  ban: z.number(),
  redact: z.number(),
  notifications: z.object({ room: z.number() }),
  events: powerLevelEventsSchema,
  users: z.record(z.string(), z.number()).optional(),
  creator_becomes: z.number().optional(),
  synapse_preset: z.string().optional(),
  default_visibility: z.enum(["public", "private"]).optional(),
  allow_is_direct: z.boolean().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const twakeChatEnvSchema = z.object({
  application_name: z.string(),
  application_welcome_message: z.string(),
  privacy_url: z.string(),
  render_html: z.boolean(),
  hide_redacted_events: z.boolean(),
  hide_unknown_events: z.boolean(),
  issue_id: z.string(),
  registration_url: z.string(),
  twake_workplace_homeserver: z.string(),
  app_grid_dashboard_available: z.boolean(),
  platform: z.string(),
  default_max_upload_avatar_size_in_bytes: z.string(),
  dev_mode: z.boolean(),
  qr_code_download_url: z.string(),
  enable_logs: z.boolean(),
  support_url: z.string(),
  enable_invitations: z.boolean(),
});

// ==========================================
// 2. Feature-specific Sub-schemas
// ==========================================

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const commonSettingsSchema = z.object({
  enabled: z.boolean(),
  application_url: z.string(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const defaultVisibilitySettingsSchema = z.object({
  visibility: z.string(),
  visible_fields: z.array(z.string()),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const userProfileSchema = z.object({
  default_visibility_settings: defaultVisibilitySettingsSchema,
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const userDirectorySchema = z.object({
  enabled: z.boolean(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const createroomProxyFailureSchema = z.object({
  max_retries: z.number().optional(),
  nuke_room: z.boolean().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const createroomProxySchema = z.object({
  enabled: z.boolean().optional(),
  on_failure: createroomProxyFailureSchema.optional(),
  default_preset: z.string().optional(),
  encryption: z.enum(["allowed", "enforced", "disabled"]).optional(),
  is_direct_mask: directChatMaskSchema.optional(),
  presets: z.array(presetConfigSchema).optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const featuresSchema = z.object({
  common_settings: commonSettingsSchema,
  matrix_profile_updates_allowed: z.boolean(),
  user_profile: userProfileSchema,
  user_directory: userDirectorySchema,
  createroom_proxy: createroomProxySchema.optional(),
});

// ==========================================
// 3. Flat Legacy Config Sections
// ==========================================

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const serverConfigSchema = z.object({
  additional_features: z.boolean().optional(),
  base_url: z.string(),
  cron_service: z.boolean(),
  rate_limiting_window: z.number().optional(),
  rate_limiting_nb_requests: z.number().optional(),
  server_name: z.string(),
  trust_x_forwarded_for: z.boolean().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const urlsConfigSchema = z.object({
  signup_url: z.string(),
  chat_url: z.string().optional(),
  auth_url: z.string().optional(),
  qr_code_url: z.string().optional(),
  invitation_redirect_url: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const synapseConfigSchema = z.object({
  matrix_server: z.string(),
  matrix_internal_host: z.string(),
  matrix_admin_login: z.string(),
  matrix_admin_password: z.string(),
  admin_access_token: z.string(),
  matrix_database_engine: z.literal("pg").nullable().optional().default("pg"),
  matrix_database_host: z.string(),
  matrix_database_name: z.string().nullable().optional(),
  matrix_database_password: z.string().nullable().optional(),
  matrix_database_ssl: connectionOptionsSchema.optional(),
  matrix_database_user: z.string().nullable().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const databaseConfigSchema = z.object({
  database_engine: z.literal("pg").default("pg"),
  database_host: z.string(),
  database_name: z.string().optional(),
  database_password: z.string().optional(),
  database_ssl: connectionOptionsSchema.optional(),
  database_user: z.string().optional(),
  database_vacuum_delay: z.number(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const hashConfigSchema = z.object({
  hashes_rate_limit: z.number().optional(),
  key_delay: z.number(),
  keys_depth: z.number(),
  pepperCron: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const invitationsConfigSchema = z.object({
  invitation_server_name: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const termsConfigSchema = z.object({
  policies: z
    .union([z.record(z.string(), z.unknown()), z.string()])
    .nullable()
    .optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const emailConfigSchema = z.object({
  mail_link_delay: z.number(),
  smtp_password: z.string().optional(),
  smtp_port: z.number().optional(),
  smtp_sender: z.string().optional(),
  smtp_server: z.string(),
  smtp_tls: z.boolean().optional(),
  smtp_user: z.string().optional(),
  smtp_verify_certificate: z.boolean().optional(),
  template_dir: z.string(),
  sender_localpart: z.string(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const ldapConfigSchema = z.object({
  ldap_filter: z.string().optional(),
  ldap_base: z.string().optional(),
  ldap_password: z.string().optional(),
  ldap_uri: z.string().optional(),
  ldap_user: z.string().optional(),
  ldap_uid_field: z.string().optional(),
  ldapts_opts: z.record(z.string(), z.any()).optional(),
  update_users_cron: z.string().optional(),
  userdb_engine: z.literal("ldap").optional().default("ldap"),
  userdb_host: z.string().optional(),
  userdb_name: z.string().optional(),
  userdb_password: z.string().optional(),
  userdb_ssl: connectionOptionsSchema.optional(),
  userdb_user: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const cacheConfigSchema = z.object({
  cache_engine: z.string().optional(),
  cache_ttl: z.number().optional(),
  redis_uri: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const smsConfigSchema = z.object({
  sms_api_login: z.string().optional(),
  sms_api_key: z.string().optional(),
  sms_api_url: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const federationConfigSchema = z.object({
  federated_identity_services: z.array(z.string()).nullable().optional(),
  is_federated_identity_service: z.boolean(),
  trusted_servers_addresses: z.array(z.string()),
  update_federated_identity_hashes_cron: z.string().optional(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const jitsiConfigSchema = z.object({
  jitsiBaseUrl: z.string(),
  jitsiJwtAlgorithm: z.string(),
  jitsiJwtIssuer: z.string(),
  jitsiJwtSecret: z.string(),
  jitsiPreferredDomain: z.string(),
  jitsiUseJwt: z.boolean(),
});

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
const oidcConfigSchema = z.object({
  oidc_issuer: z.string().optional(),
});

// ==========================================
// 4. Final Aggregated Legacy Config
// ==========================================

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const legacyConfigSchema = z.object({
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

  twake_chat: twakeChatEnvSchema,
  features: featuresSchema,
});
