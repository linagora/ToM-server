import { type TwakeLogger } from '@twake/logger';
import { AMQPConnector } from '@twake/amqp-connector';
import { type UserInformationPayload, type CommonSettingsMessage } from './types';
import type { Config } from '@twake/server/src/types';
import { QueueNotProvidedError, UrlNotProvidedError } from './errors';


export class CommonSettingsService {
  private readonly connector: AMQPConnector;
  private readonly config: Partial<Config>;
  private readonly logger: TwakeLogger;
  private readonly amqpUrl: string;
  private readonly queueName: string;

  constructor(config: Config, logger: TwakeLogger) {
    this.config = config;
    this.logger = logger;

    // Parse the AMQP URL and Queue name from config
    this.amqpUrl = this.config.common_settings_connector?.amqp_url ?? '';
    this.queueName = this.config.common_settings_connector?.queue ?? '';

    // Validate configuration
    // Ensure AMQP URL and Queue name are provided
    if (this.amqpUrl.length === 0) throw new UrlNotProvidedError();
    if (this.queueName.length === 0) throw new QueueNotProvidedError();

    // Initialize AMQP Connector
    this.connector = new AMQPConnector(this.logger)
      .withUrl(this.amqpUrl)
      .withQueue(this.queueName)
      .onMessage(this.handleMessage.bind(this));
  }

  /**
   * Start listening for settings updates
   */
  async start(): Promise<void> {
    this.logger.info(
      `[CommonSettingsService] Starting service: url=${this.amqpUrl}, queue=${this.queueName}`,
    );
    await this.connector.build();
    this.logger.info('[CommonSettingsService] Service started and listening for messages');
  }

  /**
   * Stop listening and close AMQP connection
   */
  async stop(): Promise<void> {
    this.logger.info('[CommonSettingsService] Stopping service');
    await this.connector.close();
    this.logger.info('[CommonSettingsService] Service stopped');
  }

  /**
   * Internal message handler
   * 
   * @param rawMsg The raw AMQP message
   * @returns Promise that resolves when message processing is complete
   * @throws Logs errors if message processing fails
   */
  private async handleMessage(rawMsg: any): Promise<void> {
    // Log the raw message for debugging
    const rawContent = rawMsg.content.toString();
    this.logger.info('[CommonSettingsService] Received message', { raw: rawContent });

    // Parse and validate message
    const parsed = this._safeParseMessage(rawContent);
    if (parsed == null) return;

    const { matrix_id: userId, display_name: displayName, avatar: avatarUrl } = parsed.payload ?? {};

    // Validate required fields
    // If missing, log a warning and skip processing
    if ((userId == null)) {
      this.logger.warn(
        '[CommonSettingsService] Invalid message payload: missing userId',
        { payload: parsed },
      );
      return;
    }

    try {
      this.logger.info('[CommonSettingsService] Updating the user information: ', { userId, displayName });
      await this._updateUserInformationWithRetry(userId, { displayName, avatarUrl });
      this.logger.info('[CommonSettingsService] Successfully updated the user information: ', { userId });
    } catch (err: any) {
      this.logger.error('[CommonSettingsService] Failed to update the user information: ', {
        userId,
        error: err?.message,
      });
    }
  }

  /**
   * Safe JSON parsing
   * 
   * @param raw The raw JSON string
   * @returns Parsed object or null if parsing fails
   * @throws Logs a warning if parsing fails
   */
  private _safeParseMessage(raw: string): CommonSettingsMessage | null {
    try {
      return JSON.parse(raw);
    } catch (e: any) {
      this.logger.warn('[CommonSettingsService] Invalid JSON message received', { raw }, JSON.stringify(e));
      return null;
    }
  }

  /**
   * Updates user information with retries
   * 
   * @param userId The ID of the user to update
   * @param payload The update payload
   * @param retries The number of retry attempts
   * @returns Promise that resolves when the update is successful or rejects after all retries fail
   * @throws Logs warnings on retry attempts and throws the last error if all retries fail
   */
  private async _updateUserInformationWithRetry(userId: string, payload: UserInformationPayload, retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this._updateUserInformation(userId, payload); return;
      } catch (err: any) {
        if (attempt === retries) throw err;
        this.logger.warn(`[CommonSettingsService] Retry ${attempt} for user ${userId} due to error`, { error: err.message });
        // eslint-disable-next-line promise/param-names
        await new Promise(res => setTimeout(res, attempt * 500));
      }
    }
  }

  /**
   * Calls local admin settings API to update a user’s display name
   * 
   * @param userId The ID of the user to update
   * @param payload The update payload
   * @returns Promise that resolves when the update is successful
   * @throws Throws an error if the HTTP request fails or returns a non-2xx status
   */
  private async _updateUserInformation(userId: string, payload: UserInformationPayload): Promise<void> {
    if ((this.config.synapse_admin_server == null) || (this.config.synapse_admin_secret == null)) {
      throw new Error('Synapse admin server URL or secret is not configured');
    }
    const endpoint = `${this.config.synapse_admin_server}/_twake/v1/admin/settings/information/${encodeURIComponent(userId)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        Authorization: `Bearer ${this.config.synapse_admin_secret}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update display name: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }
}

