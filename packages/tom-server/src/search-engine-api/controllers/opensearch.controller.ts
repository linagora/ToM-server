import { type TwakeLogger } from '@twake/logger'
import { AppServerAPIError } from '@twake/matrix-application-server'
import { type NextFunction, type Request, type Response } from 'express'
import { type IOpenSearchService } from '../services/interfaces/opensearch-service.interface'
import { logError } from '../utils/error'

export class OpenSearchController {
  restoreRoute = '/_twake/app/v1/opensearch/restore'

  constructor(
    private readonly _opensearchService: IOpenSearchService,
    private readonly _logger: TwakeLogger
  ) {}

  postRestore = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this._opensearchService.createTomIndexes(true)
      res.sendStatus(204)
    } catch (e: any) {
      logError(this._logger, e, {
        httpMethod: 'POST',
        endpointPath: this.restoreRoute
      })

      next(
        new AppServerAPIError({
          status: 500
        })
      )
    }
  }
}
