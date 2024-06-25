import { type IMatrixDBRoomsRepository } from '../repositories/interfaces/matrix-db-rooms-repository.interface'
import { type IOpenSearchRepository } from '../repositories/interfaces/opensearch-repository.interface'
import {
  tmailMailsIndex,
  tomMessagesIndex,
  tomRoomsIndex
} from '../utils/constantes'
import {
  type IOpenSearchMailResult,
  type IOpenSearchMessageResult,
  type IOpenSearchResponse,
  type IOpenSearchRoomResult,
  type IResponseBody,
  type ISearchEngineService
} from './interfaces/search-engine-service.interface'

export class SearchEngineService implements ISearchEngineService {
  constructor(
    private readonly _openSearchRepository: IOpenSearchRepository,
    private readonly _matrixDBRoomsRepository: IMatrixDBRoomsRepository
  ) {}

  async getMailsMessagesRoomsContainingSearchValue(
    searchValue: string,
    userId: string,
    userEmail: string
  ): Promise<IResponseBody> {
    const regexp = `.*${searchValue}.*`
    const operator = 'regexp'
    const response = await this._openSearchRepository.searchOnMultipleIndexes(
      regexp,
      {
        [tomRoomsIndex]: { operator, field: 'name' },
        [tomMessagesIndex]: [
          { operator, field: 'display_name' },
          { operator, field: 'content' }
        ],
        [tmailMailsIndex]: [
          { operator, field: 'attachments.fileName' },
          { operator, field: 'attachments.textContent' },
          { operator, field: 'bcc.address' },
          { operator, field: 'bcc.name' },
          { operator, field: 'cc.address' },
          { operator, field: 'cc.name' },
          { operator, field: 'from.address' },
          { operator, field: 'from.name' },
          { operator, field: 'to.address' },
          { operator, field: 'to.name' },
          { operator, field: 'subject' },
          { operator, field: 'textBody' },
          { operator, field: 'userFlags' }
        ]
      }
    )

    const userRoomsIds =
      await this._matrixDBRoomsRepository.getUserRoomsIds(userId)

    const openSearchRoomsResult = (
      response.body.responses as Array<
        IOpenSearchResponse<IOpenSearchRoomResult>
      >
    )[0].hits.hits.filter((osResult) => userRoomsIds.includes(osResult._id))

    const openSearchMessagesResult = (
      response.body.responses as Array<
        IOpenSearchResponse<IOpenSearchMessageResult>
      >
    )[1].hits.hits.filter((osResult) =>
      userRoomsIds.includes(osResult._source.room_id)
    )

    const openSearchMailsResult = (
      response.body.responses as Array<
        IOpenSearchResponse<IOpenSearchMailResult>
      >
    )[2].hits.hits.filter((osResult) =>
      osResult._source.bcc
        .concat(osResult._source.cc, osResult._source.from, osResult._source.to)
        .some((userDetail) => userDetail.address === userEmail)
    )

    const responseBody: IResponseBody = {
      rooms: [],
      messages: [],
      mails: openSearchMailsResult.map((result) => ({
        id: result._id ?? result._source.messageId,
        ...result._source
      }))
    }

    const roomsDetails =
      await this._matrixDBRoomsRepository.getRoomsDetails(userRoomsIds)

    openSearchRoomsResult.forEach((osResult) => {
      responseBody.rooms.push({
        room_id: osResult._id,
        name: osResult._source.name,
        avatar_url: roomsDetails[osResult._id]?.avatar
      })
    })

    const directRoomsIds =
      await this._matrixDBRoomsRepository.getDirectRoomsIds(userRoomsIds)

    const directRoomsAvatarsUrls =
      await this._matrixDBRoomsRepository.getDirectRoomsAvatarUrl(
        directRoomsIds,
        userId
      )

    openSearchMessagesResult.forEach((osResult) => {
      const roomId = osResult._source.room_id
      const message = {
        room_id: roomId,
        event_id: osResult._id,
        content: osResult._source.content,
        display_name: osResult._source.display_name
      }
      const isDirectRoom = directRoomsIds.includes(roomId)
      responseBody.messages.push({
        ...message,
        avatar_url: isDirectRoom
          ? directRoomsAvatarsUrls[roomId]
          : roomsDetails[roomId]?.avatar,
        room_name: roomsDetails[roomId]?.name
      })
    })
    return responseBody
  }
}
