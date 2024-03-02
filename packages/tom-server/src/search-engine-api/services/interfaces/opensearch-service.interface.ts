import { type ClientEvent } from '@twake/matrix-application-server'

export interface IOpenSearchService {
  updateRoomName: (event: ClientEvent) => Promise<void>
  updateDisplayName: (event: ClientEvent) => Promise<void>
  indexMessage: (event: ClientEvent) => Promise<void>
  updateMessage: (event: ClientEvent) => Promise<void>
  deindexRoom: (event: ClientEvent) => Promise<void>
  createTomIndexes: (forceRestore?: boolean) => Promise<void>
  deindexMessage: (event: ClientEvent) => Promise<void>
}
