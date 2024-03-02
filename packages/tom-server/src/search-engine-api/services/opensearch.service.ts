import tchatMapping from '../conf/tchat-mapping.json'
import { type IMatrixDBRoomsRepository } from '../repositories/interfaces/matrix-db-rooms-repository.interface'
import {
  EOpenSearchIndexingAction,
  type DocumentWithIndexingAction,
  type IOpenSearchRepository
} from '../repositories/interfaces/opensearch-repository.interface'
import { tomMessagesIndex, tomRoomsIndex } from '../utils/constantes'
import { type IOpenSearchService } from './interfaces/opensearch-service.interface'

export class OpenSearchService implements IOpenSearchService {
  constructor(
    private readonly _openSearchRepository: IOpenSearchRepository,
    private readonly _matrixDBRoomsRepository: IMatrixDBRoomsRepository
  ) {}

  async createTomIndexes(): Promise<void> {
    const [roomsIndexExists, messagesIndexExists] = await Promise.all([
      this._openSearchRepository.indexExists(tomRoomsIndex),
      this._openSearchRepository.indexExists(tomMessagesIndex)
    ])
    if (!roomsIndexExists) {
      await this._openSearchRepository.createIndex(
        tomRoomsIndex,
        tchatMapping.rooms.mappings
      )
    }

    const clearRoomsNames =
      await this._matrixDBRoomsRepository.getAllClearRoomsNames()
    if (clearRoomsNames.length > 0 && !roomsIndexExists) {
      await this._openSearchRepository.indexDocuments({
        [tomRoomsIndex]: clearRoomsNames.map((room) => ({
          id: room.room_id,
          action: EOpenSearchIndexingAction.CREATE,
          name: room.name
        }))
      })
    }

    if (!messagesIndexExists) {
      await this._openSearchRepository.createIndex(
        tomMessagesIndex,
        tchatMapping.messages.mappings
      )
    }

    const clearRoomsMessages =
      await this._matrixDBRoomsRepository.getAllClearRoomsMessages()

    if (clearRoomsMessages.length > 0 && !messagesIndexExists) {
      await this._openSearchRepository.indexDocuments({
        [tomMessagesIndex]: clearRoomsMessages.map((event) => {
          let document: DocumentWithIndexingAction = {
            id: event.event_id,
            action: EOpenSearchIndexingAction.CREATE,
            room_id: event.room_id,
            content: event.json.content.body as string,
            sender: event.json.sender
          }
          if (event.json.display_name != null) {
            document = {
              ...document,
              display_name: event.json.display_name
            }
          }
          return document
        })
      })
    }
  }
}
