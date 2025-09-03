import { type TwakeLogger } from '@twake/logger';
import { AMQPConnector } from './lib/amqp-connector';
import { type CommonSettingsMessage } from './types';
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
    this.connector = new AMQPConnector()
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
   */
  private async handleMessage(rawMsg: any): Promise<void> {
    // Log the raw message for debugging
    const rawContent = rawMsg.content.toString();
    this.logger.info('[CommonSettingsService] Received message', { raw: rawContent });

    // Parse and validate message
    const parsed = this._safeParseMessage(rawContent);
    if (parsed == null) return;

    const { matrix_id: userId, display_name: displayName } = parsed.payload ?? {};

    // Validate required fields
    // If missing, log a warning and skip processing
    if ((userId == null) || (displayName == null)) {
      this.logger.warn(
        '[CommonSettingsService] Invalid message payload: missing userId or displayName',
        { payload: parsed },
      );
      return;
    }

    try {
      this.logger.info('[CommonSettingsService] Updating display name', { userId, displayName });
      await this._updateDisplayName(userId, displayName);
      this.logger.info('[CommonSettingsService] Successfully updated display name', { userId });
    } catch (err: any) {
      this.logger.error('[CommonSettingsService] Failed to update display name', {
        userId,
        error: err?.message,
      });
    }
  }

  /**
   * Safe JSON parsing
   */
  private _safeParseMessage(raw: string): CommonSettingsMessage | null {
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.warn('[CommonSettingsService] Invalid JSON message received', { raw });
      return null;
    }
  }

  /**
   * Calls Synapse admin API to update a user’s display name
   */
  private async _updateDisplayName(userId: string, displayName: string): Promise<void> {
    const localUrl = 'http://127.0.0.1:5000';
    const endpoint = `${localUrl}/_twake/v1/admin/settings/display-name/${encodeURIComponent(userId)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        Authorization: `Bearer ${this.config.synapse_admin_secret}`,
      },
      body: JSON.stringify({ userId, displayName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update display name: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }
}

