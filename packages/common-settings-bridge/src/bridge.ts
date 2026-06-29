import { RabbitMQClient } from "@linagora/rabbitmq-client";
import type { SynapseAdminApis } from "@vector-im/matrix-bot-sdk";
import { Bridge, type Intent, Logger } from "matrix-appservice-bridge";

import { Database } from "@twake/db";
import type * as logger from "@twake/logger";

import {
  DEFAULT_AVATAR_FETCH_TIMEOUT_MS,
  DEFAULT_MAX_AVATAR_BYTES,
  type MatrixApis,
  MatrixProfileUpdater,
} from "./matrix-profile-updater";
import { SettingsRepository } from "./settings-repository";
import {
  type BridgeConfig,
  createLoggerAdapter,
  type ISettingsPayload,
  MessageParseError,
  type StoredUserSettings,
  SynapseAdminRetryMode,
  UserIdNotProvidedError,
  type UserSettingsTableName,
} from "./types";

// =============================================================================
// Message handling helpers (inlined from message-handler.ts)
// =============================================================================

/**
 * Represents a validated and parsed message ready for processing.
 */
interface ParsedMessage {
  userId: string;
  version: number;
  timestamp: number;
  requestId: string;
  source: string;
  payload: ISettingsPayload;
}

/**
 * Validates a raw AMQP message and extracts required fields. Runtime narrowing
 * is used because the lib hands us `Record<string, unknown>` without schema.
 */
function validateMessage(message: Record<string, unknown>): ParsedMessage {
  const requestId = message.request_id;
  if (typeof requestId !== "string" || requestId.length === 0) {
    throw new MessageParseError("Message missing required request_id field");
  }
  // `Number.isFinite` rejects NaN/Infinity that `typeof === "number"` lets through.
  // Infinity would later blow up `new Date(...).toISOString()` and turn ack-drop into a DLQ storm.
  const timestamp = message.timestamp;
  if (!Number.isFinite(timestamp)) {
    throw new MessageParseError("Message missing required timestamp field");
  }
  const payload = message.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MessageParseError("Message payload must be a JSON object");
  }
  const matrixId = (payload as Record<string, unknown>).matrix_id;
  if (typeof matrixId !== "string" || matrixId.length === 0) {
    throw new UserIdNotProvidedError();
  }
  const version = message.version;
  const source = message.source;
  return {
    userId: matrixId,
    version: Number.isFinite(version) ? (version as number) : 1,
    timestamp: timestamp as number,
    requestId,
    source: typeof source === "string" ? source : "",
    payload: payload as ISettingsPayload,
  };
}

/**
 * Builds an AMQP URL from the structured rabbitmq config.
 */
function buildAmqpUrl(conf: BridgeConfig["rabbitmq"]): string {
  const protocol = conf.tls === true ? "amqps" : "amqp";
  return `${protocol}://${encodeURIComponent(conf.username)}:${encodeURIComponent(conf.password)}@${conf.host}:${conf.port}/${conf.vhost}`;
}

// =============================================================================
// Version management helpers (inlined from version-manager.ts)
// =============================================================================

/**
 * Determines whether an update should be applied based on version and timestamp.
 */
function shouldApplyUpdate(lastSettings: StoredUserSettings | null, newVersion: number, newTimestamp: number): boolean {
  if (!lastSettings) return true;
  if (newVersion > lastSettings.version) return true;
  if (newVersion === lastSettings.version && newTimestamp > lastSettings.timestamp) return true;
  return false;
}

/**
 * Checks if an incoming update is an idempotent duplicate based on request ID.
 */
function isIdempotentDuplicate(lastSettings: StoredUserSettings | null, newRequestId: string): boolean {
  return lastSettings?.request_id === newRequestId;
}

/**
 * Formats a Unix timestamp (milliseconds) as an ISO 8601 string.
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

Logger.configure({
  console: (process.env.LOG_LEVEL as "info" | "debug" | "warn" | "error" | "trace" | "off" | undefined) || "info",
});

/**
 * CommonSettingsBridge handles synchronization of user settings between
 * an external system (via AMQP messages) and Matrix user profiles.
 * It listens for settings change messages and updates Matrix display names
 * and avatars accordingly.
 */
export class CommonSettingsBridge {
  readonly #config: BridgeConfig;
  readonly #log: Logger;
  #bridge!: Bridge;
  #botIntent!: Intent;
  #adminApis!: SynapseAdminApis;
  #db!: Database<UserSettingsTableName>;
  #client!: RabbitMQClient;
  #settingsRepository!: SettingsRepository;
  #profileUpdater!: MatrixProfileUpdater;
  #isDatabaseAvailable: boolean = false;

  /**
   * Creates a new CommonSettingsBridge instance.
   * @param config - The bridge configuration containing homeserver, database, and RabbitMQ settings
   */
  constructor(config: BridgeConfig) {
    this.#log = new Logger("CommonSettingsBridge");
    this.#log.debug("Initializing CommonSettingsBridge instance");
    this.#config = config;
    this.#initDatabase();
    this.#initRabbitMQClient();
    this.#log.debug("CommonSettingsBridge instance created");
  }

  /**
   * Initializes the database connection with the user settings table schema.
   * The database stores Matrix user IDs mapped to their settings JSON, version number,
   * timestamp, and request_id for idempotency.
   */
  #initDatabase(): void {
    this.#log.debug("Initializing database connection...");

    const dbConfig = {
      database_engine: this.#config.database.engine,
      database_host: this.#config.database.host ?? "localhost",
      database_name: this.#config.database.name,
      database_user: this.#config.database.user,
      database_password: this.#config.database.password,
      database_ssl: this.#config.database.ssl ?? false,
      database_vacuum_delay: this.#config.database.vacuumDelay ?? 3600,
    };

    this.#log.debug(
      `Database config: engine=${dbConfig.database_engine}, host=${dbConfig.database_host}, name=${dbConfig.database_name}, user=${dbConfig.database_user}, ssl=${dbConfig.database_ssl}, vacuumDelay=${dbConfig.database_vacuum_delay}s`,
    );

    const dbLogger = createLoggerAdapter(this.#log, "DB");

    const tables: Record<UserSettingsTableName, string> = {
      usersettings:
        "matrix_id varchar(255) PRIMARY KEY, settings jsonb, version int DEFAULT 1, timestamp bigint DEFAULT 0, request_id varchar(255) DEFAULT ''",
    };

    this.#db = new Database<UserSettingsTableName>(dbConfig, dbLogger as logger.TwakeLogger, tables);

    this.#log.debug("Database instance created");
  }

  /**
   * Initializes the RabbitMQ client. Subscription is established later in
   * `start()` once `init()` has opened the connection and channel.
   */
  #initRabbitMQClient(): void {
    this.#log.debug("Initializing RabbitMQ client...");

    const rabbitConfig = this.#config.rabbitmq;

    this.#log.debug(
      `RabbitMQ config: host=${rabbitConfig.host}, exchange=${rabbitConfig.exchange}, queue=${rabbitConfig.queue}, routingKey=${rabbitConfig.routingKey}`,
    );

    this.#client = new RabbitMQClient({
      url: buildAmqpUrl(rabbitConfig),
      prefetch: rabbitConfig.prefetch,
      maxRetries: rabbitConfig.maxRetries,
      retryDelay: rabbitConfig.retryDelay,
      logger: this.#log,
    });

    this.#log.debug("RabbitMQ client configured");
  }

  /**
   * Creates and configures the Matrix bridge instance.
   * The bridge is configured without an event handler since this service
   * only processes AMQP messages, not Matrix events.
   * @returns The configured Bridge instance
   */
  #initBridge(): Bridge {
    this.#log.debug("Initializing Matrix bridge...");
    this.#log.debug(
      `Bridge config: homeserverUrl=${this.#config.homeserverUrl}, domain=${
        this.#config.domain
      }, registration=${this.#config.registrationPath}`,
    );

    return new Bridge({
      homeserverUrl: this.#config.homeserverUrl,
      domain: this.#config.domain,
      registration: this.#config.registrationPath,
      disableStores: true,
      controller: {
        onEvent: () => {},
        onLog: (text: string, isError: boolean) => {
          if (isError) {
            this.#log.error(`[Bridge] ${text}`);
          } else {
            this.#log.debug(`[Bridge] ${text}`);
          }
        },
      },
    });
  }

  /**
   * Handles incoming AMQP messages containing user settings changes.
   * Implements idempotency checking and version-based ordering.
   * Message JSON parsing is done by the RabbitMQ client; malformed
   * payloads are routed to the DLQ before this handler is invoked.
   * @param message - The parsed settings message
   */
  async #handleMessage(message: Record<string, unknown>): Promise<void> {
    this.#log.debug("Received message");

    // Validation failures are deterministic: re-running on the same bytes will
    // fail the same way. Ack-and-drop instead of throwing, otherwise the client
    // library retries this message `maxRetries` times before DLQ'ing.
    if (message === null || typeof message !== "object" || Array.isArray(message)) {
      this.#log.error("Discarding message: payload root is not a JSON object");
      return;
    }

    let parsed: ParsedMessage;
    try {
      parsed = validateMessage(message);
    } catch (err) {
      if (err instanceof MessageParseError || err instanceof UserIdNotProvidedError) {
        this.#log.error(`Discarding message: validation failed (${(err as Error).message})`);
        return;
      }
      throw err;
    }

    const { userId, version, timestamp, requestId, source, payload } = parsed;

    this.#log.info(
      `Processing update for ${userId} (source=${source}, v=${version}, req=${requestId}, ts=${formatTimestamp(
        timestamp,
      )})`,
    );

    /* Degraded mode - no database available */
    if (!this.#isDatabaseAvailable) {
      this.#log.debug(`Degraded mode: applying update for ${userId} without idempotency checks`);
      await this.#profileUpdater.processChanges(userId, null, payload);
      this.#log.info(`Successfully processed settings for user: ${userId} (degraded mode)`);
      return;
    }

    // Track whether profile has been updated to avoid double-processing
    let profileUpdated = false;
    let lastSettings: StoredUserSettings | null = null;

    // Try to get settings from database (with error handling)
    try {
      lastSettings = await this.#settingsRepository.getUserSettings(userId);

      // Idempotency check
      if (isIdempotentDuplicate(lastSettings, requestId)) {
        this.#log.warn(`Duplicate message detected for ${userId} (request_id=${requestId}), discarding`);
        return;
      }

      // Determine if we should apply this update
      const shouldApply = shouldApplyUpdate(lastSettings, version, timestamp);

      if (!shouldApply) {
        this.#log.warn(
          `Stale update for ${userId}, discarding (current: version=${lastSettings?.version}, timestamp=${
            lastSettings ? formatTimestamp(lastSettings.timestamp) : "N/A"
          }; new: version=${version}, timestamp=${formatTimestamp(timestamp)})`,
        );
        return;
      }

      this.#log.debug(
        `Applying update for ${userId} (${
          lastSettings
            ? `old version=${lastSettings.version}, timestamp=${formatTimestamp(lastSettings.timestamp)}`
            : "new user"
        } -> new version=${version}, timestamp=${formatTimestamp(timestamp)})`,
      );
    } catch (error) {
      // Database error during read/check - switch to degraded mode
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.#log.error(`Database error while reading ${userId}: ${errorMsg}`);

      // Switch to degraded mode for future messages
      this.#isDatabaseAvailable = false;
      this.#log.warn("==========================================");
      this.#log.warn("DATABASE ERROR - Switching to degraded mode");
      this.#log.warn("Future messages will bypass idempotency checks");
      this.#log.warn("==========================================");

      // Continue processing in degraded mode (no idempotency check)
      this.#log.info(`Processing ${userId} in degraded mode (no idempotency check)`);
    }

    // Process settings changes and update Matrix profile
    // (This is outside try/catch so errors propagate normally)
    await this.#profileUpdater.processChanges(userId, lastSettings?.payload ?? null, payload);
    profileUpdated = true;

    this.#log.info(`Successfully processed settings for user: ${userId}`);

    // Save settings to database (if still available)
    if (this.#isDatabaseAvailable && profileUpdated) {
      try {
        const isNewUser = lastSettings === null;
        // Merge new payload with previous settings to preserve unchanged fields
        const mergedPayload: ISettingsPayload = {
          ...(lastSettings?.payload ?? {}),
          ...payload,
        };
        await this.#settingsRepository.saveSettings(userId, mergedPayload, {
          version,
          timestamp,
          requestId,
          isNewUser,
        });
      } catch (error) {
        // DB save failed but profile was updated - log and continue in degraded mode
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.#log.error(`Database save error for ${userId}: ${errorMsg}`);
        this.#isDatabaseAvailable = false;
        this.#log.warn("==========================================");
        this.#log.warn("DATABASE SAVE ERROR - Switching to degraded mode");
        this.#log.warn("Future messages will bypass idempotency checks");
        this.#log.warn("==========================================");
        this.#log.info(`Settings for ${userId} applied to Matrix but not saved to database`);
      }
    }
  }

  /**
   * Converts the string configuration value for admin retry mode to the enum value.
   * Defaults to DISABLED if the configuration value is not recognized.
   * @returns The SynapseAdminRetryMode enum value
   */
  #getAdminRetryMode(): SynapseAdminRetryMode {
    const mode = this.#config.synapse?.adminRetryMode;
    const validModes = Object.values(SynapseAdminRetryMode);
    return validModes.includes(mode as SynapseAdminRetryMode)
      ? (mode as SynapseAdminRetryMode)
      : SynapseAdminRetryMode.DISABLED;
  }

  /**
   * Creates a MatrixApis implementation that wraps the bridge's Matrix operations.
   * @returns MatrixApis implementation
   */
  #createMatrixApis(): MatrixApis {
    return {
      getIntent: (userId: string) => this.#bridge.getIntent(userId),
      adminUpsertUser: async (userId: string, data: Record<string, string>) => {
        await this.#adminApis.upsertUser(userId, data);
      },
      botUploadContent: async (content: Buffer, contentType: string, fileName?: string) => {
        return await this.#botIntent.matrixClient.uploadContent(content, contentType, fileName);
      },
    };
  }

  /**
   * Starts the bridge service.
   * Initializes the Matrix bridge, caches bot intent and admin APIs,
   * verifies admin privileges, waits for database readiness,
   * and starts the AMQP connector.
   */
  async start(): Promise<void> {
    this.#log.info("==========================================");
    this.#log.info("Common Settings Bridge Starting");
    this.#log.info("==========================================");

    try {
      this.#log.info("Initializing Matrix bridge...");
      this.#bridge = this.#initBridge();

      this.#log.debug("Running bridge on port 0 (disabled HTTP listener)...");
      await this.#bridge.run(0);
      this.#log.debug("Bridge started successfully");

      const botUserId = this.#bridge.getBot().getUserId();
      this.#log.info(`Bot user ID: ${botUserId}`);

      this.#log.debug("Ensuring bot is registered...");
      this.#botIntent = this.#bridge.getIntent(botUserId);
      await this.#botIntent.ensureRegistered();
      this.#log.debug("Bot registration confirmed");

      this.#log.debug("Initializing admin APIs...");
      this.#adminApis = this.#botIntent.matrixClient.adminApis.synapse;

      this.#log.debug("Checking admin privileges...");
      const isAdmin = await this.#adminApis.isSelfAdmin();
      if (isAdmin) {
        this.#log.info(`Bot ${botUserId} has admin privileges`);
      } else {
        this.#log.warn(`Bot ${botUserId} does NOT have admin privileges`);
        this.#log.warn("Admin API fallback will not be available");
      }

      // OPTIONAL: Database (degrade gracefully if unavailable)
      try {
        this.#log.info("Waiting for database to be ready...");

        // Timeout to prevent indefinite hang
        const DB_READY_TIMEOUT_MS = 30000; // 30 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Database connection timeout after ${DB_READY_TIMEOUT_MS}ms`));
          }, DB_READY_TIMEOUT_MS);
        });

        await Promise.race([this.#db.ready, timeoutPromise]);
        this.#log.info("Database connection established");

        // Ensure all required columns exist (handles schema migrations)
        this.#log.info("Ensuring database schema is up to date...");
        await this.#db.ensureColumns("usersettings", [
          { name: "settings", type: "jsonb", default: null },
          { name: "version", type: "int", default: 1 },
          { name: "timestamp", type: "bigint", default: 0 },
          { name: "request_id", type: "varchar(255)", default: "" },
        ]);
        this.#log.info("Database schema verified");

        // Initialize repository
        this.#log.debug("Initializing settings repository...");
        this.#settingsRepository = new SettingsRepository(this.#db, this.#log);
        this.#isDatabaseAvailable = true;
      } catch (error) {
        this.#log.warn("==========================================");
        this.#log.warn("DATABASE UNAVAILABLE - Running in degraded mode");
        this.#log.warn("Idempotency and version checks disabled");
        this.#log.warn(`Error: ${error instanceof Error ? error.message : String(error)}`);
        this.#log.warn("==========================================");
      }

      this.#log.debug("Initializing profile updater...");
      const retryMode = this.#getAdminRetryMode();
      const matrixApis = this.#createMatrixApis();
      this.#profileUpdater = new MatrixProfileUpdater(matrixApis, retryMode, this.#log, {
        maxSizeBytes: this.#config.synapse.avatarMaxSizeBytes ?? DEFAULT_MAX_AVATAR_BYTES,
        fetchTimeoutMs: this.#config.synapse.avatarFetchTimeoutMs ?? DEFAULT_AVATAR_FETCH_TIMEOUT_MS,
      });

      this.#log.info("Connecting RabbitMQ client...");
      await this.#client.init();
      try {
        const rabbitConfig = this.#config.rabbitmq;
        await this.#client.subscribe(
          rabbitConfig.exchange,
          rabbitConfig.routingKey ?? "#",
          rabbitConfig.queue,
          this.#handleMessage.bind(this),
        );
      } catch (subscribeError) {
        // Roll the connection back so the lib's auto-reconnect loop doesn't
        // keep a zombie session open after start() rejects.
        await this.#client.close().catch((closeErr) => {
          this.#log.warn(
            `Error closing client during rollback: ${closeErr instanceof Error ? closeErr.message : String(closeErr)}`,
          );
        });
        throw subscribeError;
      }
      this.#log.info("RabbitMQ client ready");

      this.#log.info("------------------------------------------");
      this.#log.info("Common Settings Bridge Started");
      this.#log.info("------------------------------------------");
      this.#log.info("Service running. Waiting for messages...");
      this.#log.info("Press Ctrl+C to stop");
      this.#log.info("==========================================");
    } catch (error) {
      this.#log.error("==========================================");
      this.#log.error("FATAL ERROR DURING STARTUP:");
      this.#log.error(error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        this.#log.debug(`Stack trace: ${error.stack}`);
      }
      this.#log.error("==========================================");
      throw error;
    }
  }

  /**
   * Gracefully stops the bridge service.
   * Closes the AMQP connector and database connections.
   */
  async stop(): Promise<void> {
    this.#log.info("");
    this.#log.info("==========================================");
    this.#log.info("Shutdown signal received...");
    this.#log.info("==========================================");

    // Each resource closes in its own try block so a failure on one does not
    // skip the others (the lib's close() can throw on drain timeout).
    let firstError: unknown;

    if (this.#client) {
      this.#log.info("Closing RabbitMQ client...");
      try {
        await this.#client.close();
        this.#log.info("RabbitMQ client closed");
      } catch (error) {
        firstError ??= error;
        this.#log.error(`Error closing RabbitMQ client: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (this.#db) {
      this.#log.info("Closing database connection...");
      try {
        this.#db.close();
        this.#log.info("Database closed");
      } catch (error) {
        firstError ??= error;
        this.#log.error(`Error closing database: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.#log.info("==========================================");
    this.#log.info("Common Settings Bridge Stopped");
    this.#log.info("==========================================");

    if (firstError !== undefined) {
      throw firstError;
    }
  }
}
