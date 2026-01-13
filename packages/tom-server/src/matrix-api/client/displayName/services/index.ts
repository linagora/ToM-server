import type {Response} from 'node-fetch'
import type { TwakeLogger } from '@twake-chat/logger'
// TODO: investigate unused
// import type { Config } from '../../../../types.ts'

export default class DisplayNameService {
  constructor(
    // TODO: investigate unused
    // private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.logger.info('[DisplayNameService] initialized.')
  }

  public update = async (
    userId: string,
    displayName: string
  ): Promise<Response> => {
    this.logger.info(
      `Updating display name for user ${userId} to ${displayName}`
    )
    // Here you would add the logic to update the display name in your database or service.
    // TODO: Implement the actual update logic when allowed.
    // This is a placeholder implementation.
    return {
      ok: true,
      success: true,
      userId,
      displayName
    } as unknown as Response // Replace with actual response type
  }
}
