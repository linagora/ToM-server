import { type TwakeLogger } from '@twake/logger'
import { type MatrixDBBackend } from '@twake/matrix-identity-server'
import { type NextFunction, type Request, type Response } from 'express'
import { type IMetricsService } from '../types'
import MetricsService from '../services'

export default class MetricsApiController {
  private readonly metricsService: IMetricsService

  constructor(
    private readonly db: MatrixDBBackend,
    private readonly logger: TwakeLogger
  ) {
    this.metricsService = new MetricsService(this.db, this.logger)
  }

  /**
   * Fetches the users activity stats
   *
   * @param {Request} _req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  getActivityStats = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.metricsService.getUserActivityStats()

      res.status(200).json(stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * Fetches the users message stats
   *
   * @param {Request} _req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  getMessageStats = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.metricsService.getUserMessageStats()

      res.status(200).json(stats)
    } catch (err) {
      next(err)
    }
  }
}
