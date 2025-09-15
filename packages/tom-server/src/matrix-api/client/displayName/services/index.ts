import type { TwakeLogger } from '@twake/logger';
import type { Config } from '../../../../types';

export default class DisplayNameService {
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.logger.debug('DisplayNameService initialized.');
  }

  public update = async (userId: string, displayName: string): Promise<Response> => {
    const settingsServiceBaseURL = this.config.features.common_settings.api_url;
    const settingsServiceSecret = this.config.features.common_settings.api_secret;

    const userIdLocalPart = userId.split(':')[0].substring(1);

    const userSettingsURL = `${settingsServiceBaseURL}/api/admin/user/settings/${userIdLocalPart}`;

    // fetch user settings
    const userSettingsResp = await fetch(userSettingsURL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${settingsServiceSecret}` }
    });
    const userSettings = (await userSettingsResp.json()) as any;
    const currentVersion = (userSettings?.version as number) ?? 0;

    const newSettingsPayload = {
      source: 'ToM',
      timestamp: Date.now(),
      nickname: userIdLocalPart,
      request_id: crypto.randomUUID(),
      payload: { display_name: displayName },
      version: currentVersion + 1
    };

    // update user settings
    const updateUserSettingsResp = await fetch(userSettingsURL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settingsServiceSecret}`
      },
      body: JSON.stringify(newSettingsPayload)
    });

    if (!updateUserSettingsResp.ok) {
      const errorText = await updateUserSettingsResp.text();
      this.logger.error('Failed to update user settings', errorText);
      throw new Error('Failed to update user settings');
    }

    // Return the fetch Response object directly
    return updateUserSettingsResp;
  };
}