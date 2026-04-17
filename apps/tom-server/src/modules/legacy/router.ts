import { resolve } from "node:path";

// import { RequestHandler, Router } from "express";
import { Router } from "express";
import type { Logger } from "winston";

import FederatedIdentityService from "@twake/federated-identity-service";
import TomServer from "@twake/server";

import type { Config } from "../../config/types";
import { getShareDirs } from "../../platform/paths";
import { legacyConfigSchema } from "./schema";
import type { LegacyConfig } from "./types";

// function registerGetRoutes(router: Router, routes: Record<string, RequestHandler>): void {
//   Object.keys(routes).forEach((k) => router.get(k, routes[k]));
// }

// function registerPostRoutes(router: Router, routes: Record<string, RequestHandler>): void {
//   Object.keys(routes).forEach((k) => router.post(k, routes[k]));
// }

async function initializeLegacyRoutes(router: Router, config: LegacyConfig, logger: Logger): Promise<void> {
  const tomServer = new TomServer(config, undefined, logger.child({ module: "ToM Legacy" }));
  await tomServer.ready;

  router.use(tomServer.endpoints);

  // Conditionally mount federated identity service
  if (config.is_federated_identity_service) {
    const fedServer = new FederatedIdentityService(config, undefined, logger.child({ module: "Federated ToM Legacy" }));
    await fedServer.ready;
    router.use(fedServer.routes);
    logger.info("federated identity service mounted");
  }
}

function resolveTemplatesDir(configured: string): string {
  if (configured !== "") return resolve(configured);

  for (const dir of getShareDirs()) {
    const candidate = resolve(dir, "templates");
    return candidate; // First tier — existence checked at runtime by mailer
  }
  return "";
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Arguable long, but of a rather simple complexity
export function mapToLegacyConfig(config: Config): LegacyConfig {
  return legacyConfigSchema.parse({
    // --- Server ---
    server_name: config.server.name,
    base_url: config.server.base_url,
    cron_service: config.server.enable_cron_jobs,
    additional_features: config.server.additional_features,
    rate_limiting_window: config.server.rate_limiting.window_ms,
    rate_limiting_nb_requests: config.server.rate_limiting.max_requests,

    // --- URLs ---
    signup_url: config.urls.signup,
    chat_url: config.urls.chat,
    auth_url: config.urls.auth,
    qr_code_url: config.urls.qr_code,
    invitation_redirect_url: config.urls.invitation_redirect,

    // --- Synapse ---
    matrix_server: config.synapse.server_url.replace(/^https?:\/\//, ""),
    matrix_internal_host: config.synapse.internal_host,
    matrix_admin_login: config.synapse.admin.login,
    matrix_admin_password: config.synapse.admin.password,
    admin_access_token: config.synapse.admin.access_token,
    matrix_database_host: config.synapse.database.host,
    matrix_database_name: config.synapse.database.name,
    matrix_database_user: config.synapse.database.user,
    matrix_database_password: config.synapse.database.password,
    matrix_database_ssl: config.synapse.database.ssl,

    // --- Database ---
    database_host: config.database.host,
    database_name: config.database.name,
    database_user: config.database.user,
    database_password: config.database.password,
    database_ssl: config.database.ssl,
    database_vacuum_delay: config.database.vacuum_delay,

    // --- Hash ---
    hashes_rate_limit: config.hash.rate_limit,
    key_delay: config.hash.key_delay,
    keys_depth: config.hash.keys_depth,
    pepperCron: config.hash.pepper_cron,

    // --- Invitations ---
    invitation_server_name: config.invitations.server_name !== "" ? config.invitations.server_name : config.server.name,

    // --- Terms ---
    policies: config.terms.policies ?? null,

    // --- Email ---
    smtp_server: config.email.smtp_host,
    smtp_port: config.email.smtp_port,
    smtp_tls: config.email.tls,
    smtp_user: config.email.username,
    smtp_password: config.email.password,
    smtp_sender: config.email.sender,
    sender_localpart: config.email.sender_localpart,
    smtp_verify_certificate: config.email.verify_certificate,
    template_dir: resolveTemplatesDir(config.email.templates_dir),
    mail_link_delay: config.email.link_expiry,

    // --- LDAP ---
    ldap_uri: config.ldap.uri,
    ldap_base: config.ldap.base,
    ldap_user: config.ldap.user,
    ldap_password: config.ldap.password,
    ldap_filter: config.ldap.filter,
    ldap_uid_field: config.ldap.uid_field,
    ldapts_opts: config.ldap.client_options,
    update_users_cron: config.ldap.sync_cron,

    // --- Cache ---
    // cache_engine: config.cache.engine,
    // cache_ttl: config.cache.ttl,
    // redis_uri: config.cache.redis_uri,

    // --- SMS ---
    sms_api_url: config.sms.api_url,
    sms_api_login: config.sms.api_login,
    sms_api_key: config.sms.api_key,

    // --- Federation ---
    is_federated_identity_service: config.federation.is_federated_identity_service,
    trusted_servers_addresses: config.federation.trusted_servers_addresses,
    federated_identity_services: config.federation.identity_services,
    update_federated_identity_hashes_cron: config.federation.sync_cron,

    // --- Jitsi ---
    jitsiBaseUrl: config.jitsi.base_url,
    jitsiUseJwt: config.jitsi.use_jwt,
    jitsiJwtSecret: config.jitsi.jwt_secret ?? "",
    jitsiJwtIssuer: config.jitsi.jwt_issuer ?? "",
    jitsiJwtAlgorithm: config.jitsi.jwt_algorithm,
    jitsiPreferredDomain: config.jitsi.preferred_domain ?? "",

    // --- OIDC ---
    oidc_issuer: config.oidc.issuer,

    // --- Twake Chat ---
    twake_chat: {
      application_name: config.twake_chat.application_name,
      application_welcome_message: config.twake_chat.application_welcome_message,
      privacy_url: config.twake_chat.privacy_url,
      render_html: config.twake_chat.render_html,
      hide_redacted_events: config.twake_chat.hide_redacted_events,
      hide_unknown_events: config.twake_chat.hide_unknown_events,
      issue_id: config.twake_chat.issue_id,
      registration_url: config.twake_chat.registration_url,
      twake_workplace_homeserver: config.twake_chat.twake_workplace_homeserver,
      app_grid_dashboard_available: config.twake_chat.app_grid_dashboard_available,
      platform: config.twake_chat.platform,
      default_max_upload_avatar_size_in_bytes: config.twake_chat.default_max_upload_avatar_size_in_bytes,
      dev_mode: config.twake_chat.dev_mode,
      qr_code_download_url: config.twake_chat.qr_code_download_url,
      enable_logs: config.twake_chat.enable_logs,
      support_url: config.twake_chat.support_url,
      enable_invitations: config.twake_chat.enable_invitations,
    },

    // --- Features ---
    features: {
      common_settings: {
        enabled: config.features.common_settings.enabled,
        application_url: config.features.common_settings.application_url,
      },
      matrix_profile_updates_allowed: config.features.matrix_profile_updates_allowed,
      user_profile: {
        default_visibility_settings: {
          visibility: config.features.user_profile.default_visibility_settings.visibility,
          visible_fields: config.features.user_profile.default_visibility_settings.visible_fields,
        },
      },
      user_directory: {
        enabled: config.features.user_directory.enabled,
      },
      ...(config.features.createroom_proxy !== undefined
        ? {
            createroom_proxy: {
              enabled: config.features.createroom_proxy.enabled,
              on_failure: {
                max_retries: config.features.createroom_proxy.on_failure.max_retries,
                nuke_room: config.features.createroom_proxy.on_failure.nuke_room,
              },
              default_preset: config.features.createroom_proxy.default_preset,
              encryption: config.features.createroom_proxy.encryption,
              is_direct_mask: config.features.createroom_proxy.is_direct_mask,
              presets: config.features.createroom_proxy.presets,
            },
          }
        : {}),
    },
  }) as LegacyConfig;
}

export async function createLegacyRouter(config: Config, logger: Logger): Promise<Router> {
  const router = Router();

  await initializeLegacyRoutes(router, mapToLegacyConfig(config), logger.child({ module: "legacy" }));
  logger.info("legacy router ready");

  return router;
}
