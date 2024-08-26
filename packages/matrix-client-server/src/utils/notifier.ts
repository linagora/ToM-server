/* istanbul ignore file */

import { type TwakeLogger } from '@twake/logger'

export enum StreamKeyType {
  ROOM = 'room_key',
  PRESENCE = 'presence_key',
  TYPING = 'typing_key',
  RECEIPT = 'receipt_key',
  ACCOUNT_DATA = 'account_data_key',
  PUSH_RULES = 'push_rules_key',
  TO_DEVICE = 'to_device_key',
  DEVICE_LIST = 'device_list_key',
  UN_PARTIAL_STATED_ROOMS = 'un_partial_stated_rooms_key'
}

class RoomStreamToken {
  /*
      Tokens are positions between events. The token "s1" comes after event 1.
  
              s0    s1
              |     |
          [0] ▼ [1] ▼ [2]
  
      Tokens can either be a point in the live event stream or a cursor going
      through historic events.
  
      When traversing the live event stream, events are ordered by
      `stream_ordering` (when they arrived at the homeserver).
  
      When traversing historic events, events are first ordered by their `depth`
      (`topological_ordering` in the event graph) and tie-broken by
      `stream_ordering` (when the event arrived at the homeserver).
  
      If you're looking for more info about what a token with all of the
      underscores means, ex.
      `s2633508_17_338_6732159_1082514_541479_274711_265584_1`, see the docstring
      for `StreamToken` below.
  
      ---
  
      Live tokens start with an "s" followed by the `stream_ordering` of the event
      that comes before the position of the token. Said another way:
      `stream_ordering` uniquely identifies a persisted event. The live token
      means "the position just after the event identified by `stream_ordering`".
      An example token is:
  
          s2633508
  
      ---
  
      Historic tokens start with a "t" followed by the `depth`
      (`topological_ordering` in the event graph) of the event that comes before
      the position of the token, followed by "-", followed by the
      `stream_ordering` of the event that comes before the position of the token.
      An example token is:
  
          t426-2633508
  
      ---
      */

  private readonly streamOrdering: number
  private readonly topologicalOrdering?: number
  private readonly logger?: TwakeLogger

  constructor(
    streamOrdering: number,
    topologicalOrdering?: number,
    logger?: TwakeLogger
  ) {
    this.streamOrdering = streamOrdering
    this.topologicalOrdering = topologicalOrdering
    this.logger = logger
  }

  public toString(): string {
    if (this.topologicalOrdering != null) {
      return `t${this.topologicalOrdering}-${this.streamOrdering}`
    } else {
      return `s${this.streamOrdering}`
    }
  }

  public static parse(token: string): RoomStreamToken {
    if (token.startsWith('t')) {
      const [topoStr, streamStr] = token.slice(1).split('-')
      const topologicalOrdering = parseInt(topoStr, 10)
      const streamOrdering = parseInt(streamStr, 10)
      return new RoomStreamToken(streamOrdering, topologicalOrdering)
    } else if (token.startsWith('s')) {
      const streamOrdering = parseInt(token.slice(1), 10)
      return new RoomStreamToken(streamOrdering)
    } else {
      throw new Error('Invalid room stream token')
    }
  }

  public copy_and_advance(newStreamOrdering: number): RoomStreamToken {
    if (this.topologicalOrdering != null) {
      this.logger?.error('Historical tokens cannot be advanced')
    } else {
      if (this.streamOrdering < newStreamOrdering) {
        return new RoomStreamToken(newStreamOrdering)
      }
    }
    return this
  }
}

export class StreamToken {
  /*
      A collection of keys joined together by underscores in the following
      order and which represent the position in their respective streams.
  
      ex. `s2633508_17_338_6732159_1082514_541479_274711_265584_379`
          1. `room_key`: `s2633508` which is a `RoomStreamToken`
             - `RoomStreamToken`'s can also look like `t426-2633508` or `m56~2.58~3.59`
             - See the docstring for `RoomStreamToken` for more details.
          2. `presence_key`: `17`
          3. `typing_key`: `338`
          4. `receipt_key`: `6732159`
          5. `account_data_key`: `1082514`
          6. `push_rules_key`: `541479`
          7. `to_device_key`: `274711`
          8. `device_list_key`: `265584`
          9. `un_partial_stated_rooms_key`: `379`
      */
  public readonly roomKey: RoomStreamToken
  public readonly presenceKey: number
  public readonly typingKey: number
  public readonly receiptKey: number
  public readonly accountDataKey: number
  public readonly pushRulesKey: number
  public readonly toDeviceKey: number
  public readonly deviceListKey: number
  public readonly unPartialStatedRoomsKey: number
  private readonly logger?: TwakeLogger

  private static readonly SEPARATOR = '_'

  constructor(
    roomKey: RoomStreamToken,
    presenceKey: number,
    typingKey: number,
    receiptKey: number,
    accountDataKey: number,
    pushRulesKey: number,
    toDeviceKey: number,
    deviceListKey: number,
    unPartialStatedRoomsKey: number,
    logger?: TwakeLogger
  ) {
    this.roomKey = roomKey
    this.presenceKey = presenceKey
    this.typingKey = typingKey
    this.receiptKey = receiptKey
    this.accountDataKey = accountDataKey
    this.pushRulesKey = pushRulesKey
    this.toDeviceKey = toDeviceKey
    this.deviceListKey = deviceListKey
    this.unPartialStatedRoomsKey = unPartialStatedRoomsKey
    this.logger = logger
  }

  public static fromString(token: string): StreamToken {
    const keys = token.split(this.SEPARATOR)
    if (keys.length !== 10) {
      throw new Error('Invalid stream token length')
    }

    const roomKey = RoomStreamToken.parse(keys[0])
    return new StreamToken(
      roomKey,
      parseInt(keys[1], 10),
      parseInt(keys[2], 10),
      parseInt(keys[3], 10),
      parseInt(keys[4], 10),
      parseInt(keys[5], 10),
      parseInt(keys[6], 10),
      parseInt(keys[7], 10),
      parseInt(keys[8], 10)
    )
  }

  public toString(): string {
    return [
      this.roomKey.toString(),
      this.presenceKey,
      this.typingKey,
      this.receiptKey,
      this.accountDataKey,
      this.pushRulesKey,
      this.toDeviceKey,
      this.deviceListKey,
      this.unPartialStatedRoomsKey
    ].join(StreamToken.SEPARATOR)
  }

  public copy_and_advance(key: StreamKeyType, newValue: any): StreamToken {
    let newToken: StreamToken

    if (key === StreamKeyType.ROOM) {
      const newRoomKey = this.roomKey.copy_and_advance(newValue)
      return this.copy_and_replace(key, newRoomKey)
    } else {
      newToken = this.copy_and_replace(key, newValue)
    }
    const currentValue = this.getField(key)
    const updatedValue = newToken.getField(key)
    if (currentValue < updatedValue) {
      this.logger?.info('Stream token successfully advanced')
      return newToken
    } else {
      this.logger?.warn('Stream token failed to advance')
      return this
    }
  }

  private copy_and_replace(key: StreamKeyType, newValue: any): StreamToken {
    return new StreamToken(
      key === StreamKeyType.ROOM ? newValue : this.roomKey,
      key === StreamKeyType.PRESENCE ? newValue : this.presenceKey,
      key === StreamKeyType.TYPING ? newValue : this.typingKey,
      key === StreamKeyType.RECEIPT ? newValue : this.receiptKey,
      key === StreamKeyType.ACCOUNT_DATA ? newValue : this.accountDataKey,
      key === StreamKeyType.PUSH_RULES ? newValue : this.pushRulesKey,
      key === StreamKeyType.TO_DEVICE ? newValue : this.toDeviceKey,
      key === StreamKeyType.DEVICE_LIST ? newValue : this.deviceListKey,
      key === StreamKeyType.UN_PARTIAL_STATED_ROOMS
        ? newValue
        : this.unPartialStatedRoomsKey
    )
  }

  private getField(key: StreamKeyType): any {
    switch (key) {
      case StreamKeyType.ROOM:
        return this.roomKey
      case StreamKeyType.PRESENCE:
        return this.presenceKey
      case StreamKeyType.TYPING:
        return this.typingKey
      case StreamKeyType.RECEIPT:
        return this.receiptKey
      case StreamKeyType.ACCOUNT_DATA:
        return this.accountDataKey
      case StreamKeyType.PUSH_RULES:
        return this.pushRulesKey
      case StreamKeyType.TO_DEVICE:
        return this.toDeviceKey
      case StreamKeyType.DEVICE_LIST:
        return this.deviceListKey
      case StreamKeyType.UN_PARTIAL_STATED_ROOMS:
        return this.unPartialStatedRoomsKey
      default:
        throw new Error('Invalid StreamKeyType')
    }
  }
}

class UpdateNotifier {
  private resolve!: (token: StreamToken) => void
  private promise: Promise<StreamToken>
  private listenersCount: number

  constructor() {
    this.promise = new Promise<StreamToken>((resolve) => {
      this.resolve = resolve
    })
    this.listenersCount = 0
  }

  notify(newToken: StreamToken): void {
    this.resolve(newToken)
    // Reset the promise to allow waiting for future events
    this.promise = new Promise<StreamToken>((resolve) => {
      this.resolve = resolve
    })
    this.listenersCount = 0
  }

  async waitForNextEvent(): Promise<StreamToken> {
    this.listenersCount += 1
    const token = await this.promise
    this.listenersCount -= 1
    return token
  }

  countListeners(): number {
    return this.listenersCount
  }
}

class UserStream {
  private readonly userId: string
  private readonly rooms: Set<string>
  private currentToken: StreamToken
  private lastNotifiedToken: StreamToken
  private lastNotifiedMs: number
  private readonly notifyDeferred: UpdateNotifier
  private readonly logger?: TwakeLogger

  constructor(
    userId: string,
    initialRooms: string[],
    initialToken: StreamToken,
    timeMs: number,
    logger?: TwakeLogger
  ) {
    this.userId = userId
    this.rooms = new Set(initialRooms)
    this.currentToken = initialToken
    this.lastNotifiedToken = initialToken
    this.lastNotifiedMs = timeMs
    this.notifyDeferred = new UpdateNotifier()
    this.logger = logger
  }

  notify(
    streamKey: StreamKeyType,
    streamId: number | RoomStreamToken,
    timeNowMs: number
  ): void {
    this.currentToken = this.currentToken.copy_and_advance(streamKey, streamId)
    this.lastNotifiedToken = this.currentToken
    this.lastNotifiedMs = timeNowMs

    this.logger?.info(
      `User ${
        this.userId
      } notified with stream key: ${streamKey} and stream id: ${streamId.toString()} and ${this.countListeners()} listeners`
    )

    this.notifyDeferred.notify(this.currentToken)
  }

  addListener(token: StreamToken): UpdateNotifier {
    if (this.lastNotifiedToken !== token) {
      return new UpdateNotifier()
    } else {
      return this.notifyDeferred
    }
  }

  countListeners(): number {
    return this.notifyDeferred.countListeners()
  }

  getUserId(): string {
    return this.userId
  }

  getToken(): StreamToken {
    return this.currentToken
  }
}

export class Notifier {
  private readonly userStreams: Map<string, UserStream>
  private readonly roomStreams: Map<string, Set<UserStream>>
  private readonly logger?: TwakeLogger

  constructor(logger?: TwakeLogger) {
    this.userStreams = new Map<string, UserStream>()
    this.roomStreams = new Map<string, Set<UserStream>>()
    this.logger = logger
  }

  getUserStream(userId: string): UserStream {
    const userStream = this.userStreams.get(userId)
    if (userStream == null) {
      throw new Error('User stream not found')
    }
    return userStream
  }

  protected getRoomStream(roomId: string): Set<UserStream> {
    if (this.roomStreams.get(roomId) == null) {
      return new Set<UserStream>()
    }
    return this.roomStreams.get(roomId) as Set<UserStream>
  }

  deleteUserStream(userId: string): void {
    /* Deletes a user from every stream of the notifier */
    this.userStreams.delete(userId)
    for (const [roomId, roomStream] of this.roomStreams) {
      for (const userStream of roomStream) {
        if (userStream.getUserId() === userId) {
          this.roomStreams.delete(roomId)
        }
      }
    }
  }

  protected getUserStreamsFromRoom(roomId: string): Set<UserStream> {
    const roomStreams = this.roomStreams.get(roomId)
    if (roomStreams == null) {
      return new Set()
    }
    return roomStreams
  }

  onNewEvent(
    streamKey: StreamKeyType,
    newToken: RoomStreamToken | number,
    users: string[] = [], // List of user IDs to notify
    rooms: string[] = [] // List of room IDs to notify
  ): void {
    const userStreams = new Set<UserStream>()

    // Collect user streams for all specified users
    for (const user of users) {
      const userStream = this.userStreams.get(user)
      if (userStream != null) {
        userStreams.add(userStream)
      }
    }

    // Collect user streams for all specified rooms
    for (const room of rooms) {
      const roomStreams = this.getUserStreamsFromRoom(room)
      roomStreams.forEach((stream: UserStream) => userStreams.add(stream))
    }

    for (const userStream of userStreams) {
      try {
        userStream.notify(streamKey, newToken, Date.now())
      } catch (error) {
        this.logger?.error('Failed to notify listener', error)
      }
    }

    // Notifying application services may be needed
  }
}
