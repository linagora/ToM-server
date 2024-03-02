import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixApplicationServer, {
  type AppService
} from '@twake/matrix-application-server'
import { type MatrixDB } from '@twake/matrix-identity-server'
import { Router } from 'express'
import { type Config } from '../types'
import { type IMatrixDBRoomsRepository } from './repositories/interfaces/matrix-db-rooms-repository.interface'
import { type IOpenSearchRepository } from './repositories/interfaces/opensearch-repository.interface'
import { MatrixDBRoomsRepository } from './repositories/matrix-db-rooms.repository'
import { OpenSearchRepository } from './repositories/opensearch.repository'
import { type IOpenSearchService } from './services/interfaces/opensearch-service.interface'
import { OpenSearchService } from './services/opensearch.service'
import { formatErrorMessageForLog } from './utils/error'

export default class TwakeSearchEngine
  extends MatrixApplicationServer
  implements AppService
{
  routes = Router()
  declare conf: Config
  ready!: Promise<void>
  public readonly openSearchService: IOpenSearchService
  public readonly openSearchRepository: IOpenSearchRepository
  public readonly matrixDBRoomsRepository: IMatrixDBRoomsRepository

  constructor(
    matrixDb: MatrixDB,
    conf: Config,
    logger: TwakeLogger,
    confDesc?: ConfigDescription
  ) {
    super(conf, confDesc, logger)
    this.openSearchRepository = new OpenSearchRepository(this.conf, this.logger)
    this.matrixDBRoomsRepository = new MatrixDBRoomsRepository(matrixDb)
    this.openSearchService = new OpenSearchService(
      this.openSearchRepository,
      this.matrixDBRoomsRepository
    )

    this.ready = new Promise<void>((resolve, reject) => {
      this.openSearchService
        .createTomIndexes()
        .then(() => {
          resolve()
        })
        .catch((e) => {
          reject(formatErrorMessageForLog(e))
        })
    })
  }

  close(): void {
    this.openSearchRepository.close()
  }
}
