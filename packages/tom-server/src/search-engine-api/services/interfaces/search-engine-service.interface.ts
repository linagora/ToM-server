export interface ISearchEngineService {
  getMailsMessagesRoomsContainingSearchValue: (
    searchValue: string,
    userId: string,
    userEmail: string
  ) => Promise<IResponseBody>
}

export interface IOpenSearchResponse<T> {
  took: number
  timed_out: boolean
  _shards: {
    total: number
    successful: number
    skipped: number
    failed: number
  }
  hits: {
    total: { value: number; relation: string }
    max_score: 1
    hits: Array<IOpenSearchResult<T>>
  }
  status: number
}

interface IOpenSearchResult<T> {
  _index: string
  _id: string
  _score: number
  _source: T
}

export interface IOpenSearchRoomResult {
  name: string
}

export interface IOpenSearchMessageResult {
  room_id: string
  content: string
  sender: string
  display_name: string | null
}

export interface IOpenSearchMailResult {
  attachments: Array<{
    contentDisposition: string
    fileExtension: string
    fileName: string
    mediaType: string
    subtype: string
    textContent: string
  }>
  bcc: Array<{
    address: string
    domain: string
    name: string
  }>
  cc: Array<{
    address: string
    domain: string
    name: string
  }>
  date: string
  from: Array<{
    address: string
    domain: string
    name: string
  }>
  hasAttachment: boolean
  headers: Array<{
    name: string
    value: string
  }>
  htmlBody: string
  isAnswered: boolean
  isDeleted: boolean
  isDraft: boolean
  isFlagged: boolean
  isRecent: boolean
  isUnread: boolean
  mailboxId: string
  mediaType: string
  messageId: string
  mimeMessageID: string
  modSeq: number
  saveDate: string
  sentDate: string
  size: number
  subject: string[]
  subtype: string
  textBody: string
  threadId: string
  to: Array<{
    address: string
    domain: string
    name: string
  }>
  uid: number
  userFlags: string[]
}

export interface IResponseBody {
  rooms: Array<{
    room_id: string
    name: string
    avatar_url: string | null
  }>
  messages: Array<{
    room_id: string
    event_id: string
    content: string
    display_name: string | null
    avatar_url: string | null
    room_name: string | null
  }>
  mails: Array<{ id: string } & IOpenSearchMailResult>
}
