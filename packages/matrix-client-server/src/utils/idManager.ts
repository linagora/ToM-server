import { Mutex } from 'async-mutex'
import type MatrixDBmodified from '../matrixDb'
import { type TwakeLogger } from '@twake/logger'

export enum StreamName {
  ACCOUNT_DATA = 'account_data',
  EVENTS = 'events',
  PRESENCE = 'presence'
  // Add other stream names as needed
}

async function getStreamPosition(
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger,
  streamName: StreamName
): Promise<number | null> {
  await matrixDb.ready
  logger.info(
    `Matrix Db ready : Getting stream position for stream ${streamName}`
  )
  return await matrixDb
    .getMaxWhereEqual('stream_positions', 'stream_id', ['stream_id'], {
      stream_name: streamName
    })
    .then((result) => {
      if (result.length === 0) {
        return null
      }
      return result[0].stream_id as number
    })
    .catch((e) => {
      /* istanbul ignore next */
      logger.error(
        `Failed to get stream position for stream ${streamName}: ${String(e)}`
      )
      /* istanbul ignore next */
      throw e
    })
}

export class IdManager {
  private currentId: number
  private readonly streamName: StreamName
  private readonly matrixDb: MatrixDBmodified
  private readonly logger: TwakeLogger
  private readonly mutex: Mutex

  private constructor(
    matrixDb: MatrixDBmodified,
    logger: TwakeLogger,
    streamName: StreamName,
    currentId: number
  ) {
    this.matrixDb = matrixDb
    this.logger = logger
    this.streamName = streamName
    this.mutex = new Mutex()
    this.currentId = currentId
  }

  public static async createIdManager(
    matrixDb: MatrixDBmodified,
    logger: TwakeLogger,
    streamName: StreamName
  ): Promise<IdManager> {
    return await getStreamPosition(matrixDb, logger, streamName)
      .then((streamId) => {
        const initialId = streamId !== null ? streamId : 0
        logger.info(
          `Created and initialized IdManager with stream ID ${initialId} for stream ${streamName}`
        )
        return new IdManager(matrixDb, logger, streamName, initialId)
      })
      .catch((e) => {
        /* istanbul ignore next */
        logger.error(`Failed to create IdManager: ${String(e)}`)
        /* istanbul ignore next */
        throw e
      })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  public getNextId(): Promise<number> {
    return this.mutex.acquire().then(async (release) => {
      return await this.matrixDb
        .updateWithConditions(
          'stream_positions',
          { stream_id: this.currentId + 1 },
          [{ field: 'stream_name', value: this.streamName }]
        )
        .then(async (rows) => {
          if (rows.length === 0) {
            this.logger.info('No stream position found, inserting new one')
            return await this.matrixDb
              .insert('stream_positions', {
                stream_name: this.streamName,
                instance_name: 'default', // cf. .md
                stream_id: this.currentId + 1
              })
              .then(() => {
                this.currentId += 1
                return this.currentId
              })
              .catch((e) => {
                /* istanbul ignore next */
                this.logger.error(
                  `Failed to insert new stream position for stream ${
                    this.streamName
                  }: ${String(e)}`
                )
                /* istanbul ignore next */
                throw e
              })
          } else {
            this.logger.info('Stream position found, updating it')
            this.currentId += 1
            return this.currentId
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.error(
            `Failed to get next ID for stream ${this.streamName}: ${String(e)}`
          )
          /* istanbul ignore next */
          throw e
        })
        .finally(() => {
          release()
        })
    })
  }

  public getCurrentId(): number {
    return this.currentId
  }
}
