import { TwakeLogger } from '@twake/logger'
import { Config } from '../../../../types'

export default class RoomService {
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {}

  public create = async (body: any, token: string): Promise<void> => {
    try {
    } catch (error) {
      this.logger.error(`Failed to create room`, error)
    }
  }
}
