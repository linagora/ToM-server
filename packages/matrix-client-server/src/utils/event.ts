import { type TwakeLogger } from '@twake/logger'
import { type ClientEvent } from '../types'
import { isEventTypeValid, isMatrixIdValid, isRoomIdValid } from '@twake/utils'
import type MatrixClientServer from '..'

export class Event {
  private event: ClientEvent

  private isRedacted: boolean
  private isEncrypted: boolean

  constructor(event: Record<string, any>, logger?: TwakeLogger) {
    // Validate and assign properties to ensure data integrity
    this.event = this.validateAndCreateEvent(event, logger)
    this.isRedacted = false
    this.isEncrypted = false
  }

  protected validateAndCreateEvent(
    event: Record<string, any>,
    logger?: TwakeLogger
  ): ClientEvent {
    if (event.event_id == null || typeof event.event_id !== 'string') {
      logger?.error('Invalid event_id')
      throw new Error('Invalid event_id')
    }
    if (
      event.type == null ||
      typeof event.type !== 'string' ||
      !isEventTypeValid(event.type)
    ) {
      console.log('Invalid type', event.type)
      logger?.error('Invalid type')
      throw new Error('Invalid type')
    }
    if (
      event.room_id == null ||
      typeof event.room_id !== 'string' ||
      !isRoomIdValid(event.room_id)
    ) {
      logger?.error('Invalid room_id')
      throw new Error('Invalid room_id')
    }
    if (
      event.sender == null ||
      typeof event.sender !== 'string' ||
      !isMatrixIdValid(event.sender)
    ) {
      logger?.error('Invalid sender')
      throw new Error('Invalid sender')
    }
    if (
      event.content == null ||
      typeof event.content !== 'object' ||
      Array.isArray(event.content) ||
      Object.keys(event.content).some((key) => typeof key !== 'string')
    ) {
      logger?.error('Invalid content')
      throw new Error('Invalid content')
    }
    if (
      event.origin_server_ts == null ||
      typeof event.origin_server_ts !== 'number'
    ) {
      logger?.error('Invalid origin_server_ts')
      throw new Error('Invalid origin_server_ts')
    }

    return {
      event_id: event.event_id,
      type: event.type,
      room_id: event.room_id,
      sender: event.sender,
      origin_server_ts: event.origin_server_ts,
      content: event.content,
      state_key: event.state_key,
      unsigned: event.unsigned
    }
  }

  // public send(room:Room): void {

  // }

  public encrypt(logger?: TwakeLogger): void {
    if (this.isEncrypted) {
      logger?.info('Event is already encrypted')
      return
    }
    this.isEncrypted = true
    // TODO : Encrypt the event
    // cf https://spec.matrix.org/v1.11/client-server-api/#end-to-end-encryption
  }

  public sign(ClientServer: MatrixClientServer): void {
    // TODO : Sign the event
    // https://spec.matrix.org/v1.11/server-server-api/#signing-events
  }

  public redact(logger?: TwakeLogger): void {
    if (this.isRedacted) {
      logger?.info('Event is already redacted')
      return
    }
    this.isRedacted = true
    const allowedKeys = new Set([
      'event_id',
      'type',
      'room_id',
      'sender',
      'state_key',
      'content',
      'hashes',
      'signatures',
      'depth',
      'prev_events',
      'auth_events',
      'origin_server_ts'
    ])
    const allowedContentKeys: Record<string, Set<string>> = {
      'm.room.member': new Set([
        'membership',
        'join_authorised_via_users_server',
        'third_party_invite'
      ]),
      'm.room.join_rules': new Set(['join_rule', 'allow']),
      'm.room.power_levels': new Set([
        'ban',
        'events',
        'events_default',
        'invite',
        'kick',
        'redact',
        'state_default',
        'users',
        'users_default'
      ]),
      'm.room.history_visibility': new Set(['history_visibility']),
      'm.room.redaction': new Set(['redacts'])
    }

    const filterObject = <T>(obj: T, allowedKeys: Set<string>): Partial<T> => {
      const result: Partial<T> = {}
      for (const key in obj) {
        if (allowedKeys.has(key as string)) {
          result[key as keyof T] = obj[key]
        } else {
          logger?.warn(`Redacted key: ${key}`)
        }
      }
      return result
    }

    // Create a filtered copy of the event
    this.event = filterObject(this.event, allowedKeys) as ClientEvent

    // Handle content-specific redactions
    const eventType = this.event.type
    if (eventType.length > 0 && this.event.content != null) {
      const allowedContent = allowedContentKeys[eventType]
      if (allowedContent != null) {
        this.event.content = filterObject(this.event.content, allowedContent)
      } else if (eventType !== 'm.room.create') {
        // Redact all content for events other than m.room.create and specified allowed content keys
        logger?.warn(`Redacted content for event type: ${eventType}`)
        this.event.content = {}
      }
    }
  }

  public hasBeenRedacted(): boolean {
    return this.isRedacted
  }

  public getEvent(): ClientEvent {
    return this.event
  }
}
