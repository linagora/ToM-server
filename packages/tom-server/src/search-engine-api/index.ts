import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixApplicationServer, {
  type AppService,
  type ClientEvent
} from '@twake/matrix-application-server'
import { type MatrixDB } from '@twake/matrix-identity-server'
import { Router } from 'express'
import { type Config } from '../types'
import { type IMatrixDBRoomsRepository } from './repositories/interfaces/matrix-db-rooms-repository.interface'
import { type IOpenSearchRepository } from './repositories/interfaces/opensearch-repository.interface'
import { MatrixDBRoomsRepository } from './repositories/matrix-db-rooms.repository'
import { OpenSearchRepository } from './repositories/opensearch.repository'
import { extendRoutes } from './routes'
import { type IOpenSearchService } from './services/interfaces/opensearch-service.interface'
import { OpenSearchService } from './services/opensearch.service'
import { formatErrorMessageForLog, logError } from './utils/error'

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
          extendRoutes(this)
          this.on('state event | type: m.room.name', (event: ClientEvent) => {
            this.openSearchService.updateRoomName(event).catch((e: any) => {
              logError(this.logger, e)
            })
          })

          this.on(
            'state event | type: m.room.encryption',
            (event: ClientEvent) => {
              if (event.content.algorithm != null) {
                this.openSearchService.deindexRoom(event).catch((e: any) => {
                  logError(this.logger, e)
                })
              }
            }
          )

          this.on('type: m.room.message', (event: ClientEvent) => {
            if (
              event.content['m.new_content'] != null &&
              (event.content['m.relates_to'] as Record<string, string>)
                ?.event_id != null &&
              (event.content['m.relates_to'] as Record<string, string>)
                ?.rel_type === 'm.replace'
            ) {
              this.openSearchService.updateMessage(event).catch((e: any) => {
                logError(this.logger, e)
              })
            } else {
              this.openSearchService.indexMessage(event).catch((e: any) => {
                logError(this.logger, e)
              })
            }
          })

          this.on('type: m.room.redaction', (event: ClientEvent) => {
            if (event.redacts?.match(/^\$.{1,255}$/g) != null) {
              this.openSearchService.deindexMessage(event).catch((e: any) => {
                logError(this.logger, e)
              })
            }
          })

          this.on('state event | type: m.room.member', (event: ClientEvent) => {
            if (
              event.unsigned?.prev_content?.displayname != null &&
              event.content.displayname != null &&
              event.content.displayname !==
                event.unsigned?.prev_content?.displayname
            ) {
              this.openSearchService
                .updateDisplayName(event)
                .catch((e: any) => {
                  logError(this.logger, e)
                })
            }
          })
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
