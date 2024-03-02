import { type ClientEvent } from '@twake/matrix-application-server'
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

  async updateRoomName(event: ClientEvent): Promise<void> {
    const isEncryptedRoom = await this._matrixDBRoomsRepository.isEncryptedRoom(
      event.room_id
    )

    if (!isEncryptedRoom) {
      await this._openSearchRepository.indexDocument(tomRoomsIndex, {
        id: event.room_id,
        name: event.content.name as string
      })
    }
  }

  async updateDisplayName(event: ClientEvent): Promise<void> {
    await this._openSearchRepository.updateDocuments(
      tomMessagesIndex,
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `ctx._source.display_name = "${event.content.displayname as string}"`,
      { match: { sender: event.sender } }
    )
  }

  async deindexRoom(event: ClientEvent): Promise<void> {
    await this._openSearchRepository.deleteDocument(
      tomRoomsIndex,
      event.room_id
    )
    await this._openSearchRepository.deleteDocuments(tomMessagesIndex, {
      match: { room_id: event.room_id }
    })
  }

  async deindexMessage(event: ClientEvent): Promise<void> {
    await this._openSearchRepository.deleteDocument(
      tomMessagesIndex,
      event.redacts as string
    )
  }

  async indexMessage(event: ClientEvent): Promise<void> {
    const roomDetail = await this._matrixDBRoomsRepository.getRoomDetail(
      event.room_id
    )
    if (roomDetail.encryption == null) {
      const displayName =
        await this._matrixDBRoomsRepository.getUserDisplayName(
          event.room_id,
          event.sender
        )

      let body: any = {
        [tomMessagesIndex]: {
          id: event.event_id,
          action: EOpenSearchIndexingAction.CREATE,
          room_id: event.room_id,
          content: event.content.body,
          sender: event.sender
        }
      }
      if (displayName != null) {
        body[tomMessagesIndex] = {
          ...body[tomMessagesIndex],
          display_name: displayName
        }
      }
      if (roomDetail.name != null) {
        body = {
          ...body,
          [tomRoomsIndex]: {
            id: event.room_id,
            action: EOpenSearchIndexingAction.INDEX,
            name: roomDetail.name
          }
        }
      }
      await this._openSearchRepository.indexDocuments(body)
    }
  }

  async updateMessage(event: ClientEvent): Promise<void> {
    const isEncryptedRoom = await this._matrixDBRoomsRepository.isEncryptedRoom(
      event.room_id
    )

    if (!isEncryptedRoom) {
      await this._openSearchRepository.updateDocument(tomMessagesIndex, {
        id: (event.content['m.relates_to'] as Record<string, string>).event_id,
        content: (event.content['m.new_content'] as Record<string, string>).body
      })
    }
  }

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
