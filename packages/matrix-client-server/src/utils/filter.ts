/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/naming-convention */

/* 
Filters are used in the Matrix Protocol in the context of lazy loading. 
They are used to filter out events that are not needed by the client.
cf : https://spec.matrix.org/v1.11/client-server-api/#api-endpoints for more details

The Filter class is used to create filters for the client.

All Filter objecs have a check method which allows it to check if an event should be filter out or not.

To be noted: the limit attributes of the filters are not used in the check method but are intented to be used in the 
lazy-loading dependent endpoint after events have been filtered.
This might be sub-optimal so it might be interesting to refactor the code to use the limit attribute in the check method.

(The limit has been set to 10 by default following synapse's implementation of the matrix Protocol)
*/

import { type ClientEvent } from '../types'

type JsonMapping = Record<string, any>

export class Filter {
  public account_data: AccountDataFilter
  public event_fields: string[]
  public event_format: string
  public presence: PresenceFilter
  public room: RoomFilter

  constructor(filter_json: JsonMapping) {
    this.account_data = new AccountDataFilter(filter_json.account_data)
    this.event_fields = filter_json.event_fields || []
    this.event_format = filter_json.event_format || 'client'
    this.presence = new PresenceFilter(filter_json.presence)
    this.room = new RoomFilter(filter_json.room)
  }

  public check(event: ClientEvent): boolean {
    const event_type = getTypeAllEvent(event.type)

    switch (event_type) {
      case 'account_data':
        return this.account_data.check(event)

      case 'presence':
        return this.presence.check(event)

      case 'room':
        return this.room.state.check(event)

      default:
        throw new Error('Invalid event type in Filter')
    }
  }
}

class BasicFilter {
  public limit: number
  readonly types: string[] | null
  readonly not_types: string[]
  readonly senders: string[] | null
  readonly not_senders: string[]

  public event_fields: string[]
  public event_format: string

  constructor(
    filter_json: JsonMapping,
    event_fields: string[] = [],
    event_format: string = 'client'
  ) {
    this.limit = filter_json.limit || 10
    this.types = filter_json.types || null
    this.not_types = filter_json.not_types || []
    this.senders = filter_json.senders || null
    this.not_senders = filter_json.not_senders || []
    this.event_fields = event_fields
    this.event_format = event_format
  }

  filtersAllTypes(): boolean {
    return this.types === null || this.not_types.includes('*')
  }

  filtersAllSenders(): boolean {
    return this.senders === null || this.not_senders.includes('*')
  }

  protected get(element: string): string[] | null {
    if (element === 'senders') {
      return this.senders
    } else if (element === 'types') {
      return this.types
    } else {
      throw new Error('Invalid element in get function of Filter')
    }
  }

  protected getNot(element: string): string[] {
    if (element === 'senders') {
      return this.not_senders
    } else if (element === 'types') {
      return this.not_types
    } else {
      throw new Error('Invalid element in getNot function of Filter')
    }
  }

  protected _checkFields(
    field_matchers: Record<string, (v: string) => boolean>
  ): boolean {
    for (const [name, match_func] of Object.entries(field_matchers)) {
      const disallowed_values = this.getNot(name)
      if (disallowed_values.some(match_func)) return false

      const allowed_values = this.get(name)
      if (allowed_values !== null && !allowed_values.some(match_func))
        return false
    }
    return true
  }

  public check(event: ClientEvent): boolean {
    const content = event.content || {}
    const sender = event.sender || content.user_id
    const ev_type = event.type || null

    const field_matchers = {
      senders: (v: string) => sender === v,
      types: (v: string) => _matchesWildcard(ev_type, v)
    }

    const result = this._checkFields(field_matchers)
    return result
  }
}

// This function is used to check if the actual value matches the filter value
function _matchesWildcard(
  actual_value: string | null,
  filter_value: string
): boolean {
  if (filter_value.endsWith('*') && typeof actual_value === 'string') {
    const type_prefix = filter_value.slice(0, -1)
    return actual_value.startsWith(type_prefix)
  } else {
    return actual_value === filter_value
  }
}

/* Filters:
    m.push_rules: Stores the user's push notification rules.
    m.ignored_user_list: Stores the list of users that the user has chosen to ignore.
    m.direct: Stores information about direct message rooms.
    m.tag_order: Stores the order of tags for the user.
    m.user_devices: Stores information about the user's devices.
*/
class AccountDataFilter extends BasicFilter {}

// Filters: m.presence
class PresenceFilter extends BasicFilter {}

/* Filters:
    m.room.message: Represents a message sent to a room.
    m.room.name: Sets the name of the room.
    m.room.topic: Sets the topic of the room.
    m.room.avatar: Sets the avatar of the room.
    m.room.canonical_alias: Sets the primary alias of the room.
    m.room.aliases: Lists the aliases of the room.
    m.room.member: Manages membership of users in the room (e.g., join, leave, ban).
    m.room.create: Indicates the creation of the room and defines properties like the room creator.
    m.room.join_rules: Defines the rules for how users can join the room (e.g., public, invite-only).
    m.room.power_levels: Defines the power levels of users in the room, determining their permissions.
    m.room.history_visibility: Controls who can see the room history.
    m.room.guest_access: Controls guest access to the room.
    m.room.encryption: Indicates that the room is encrypted and provides encryption settings.
    m.room.server_acl: Defines the servers that are allowed or denied access to the room.
    m.room.third_party_invite: Used to invite a third-party user to the room.
    m.room.pinned_events: Specifies events that are pinned in the room.

    Ephemeral Events
        m.typing: Indicates which users are currently typing.
        m.receipt: Acknowledges the receipt of messages, typically used for read receipts.
        m.presence: Updates presence information of users (e.g., online, offline).
        m.room.message.feedback: Provides feedback on messages (e.g., read receipts).
        m.room.redaction: Redacts (removes) another event from the room.

    Call Events
        m.call.invite: Invites a user to a VoIP call.
        m.call.candidates: Provides ICE candidates for establishing a call.
        m.call.answer: Answers a VoIP call.
        m.call.hangup: Ends a VoIP call.
        m.call.reject: Rejects a VoIP call.
        Reaction Events
        m.reaction: Represents reactions (like emojis) to other events.
        Room Tags
        m.tag: Tags events to allow clients to organize rooms by tags (e.g., favorites).

    User-Defined Events
        m.custom.event: Allows users to define and use custom events. These are not standardized and can vary between implementations.
*/
class RoomEventFilter extends BasicFilter {
  public contains_url: boolean | null
  public include_redundant_members: boolean
  public lazy_load_members: boolean
  public unread_thread_notifications: boolean
  public not_rooms: string[]
  public rooms: string[]

  constructor(
    filter_json: JsonMapping,
    event_fields: string[] = [],
    event_format: string = 'client'
  ) {
    super(filter_json, event_fields, event_format)
    this.contains_url = filter_json.contains_url || null
    this.not_rooms = filter_json.not_rooms || []
    this.rooms = filter_json.rooms || []
    this.include_redundant_members =
      filter_json.include_redundant_members || false
    this.lazy_load_members = filter_json.lazy_load_members || false
    this.unread_thread_notifications =
      filter_json.unread_thread_notifications || false
  }

  // Overriding method to include room field
  protected get(element: string): string[] | null {
    if (element === 'senders') {
      return this.senders
    } else if (element === 'types') {
      return this.types
    } else if (element === 'rooms') {
      return this.rooms
    } else {
      throw new Error('Invalid element in get function of Filter')
    }
  }

  // Overriding method to include room field
  protected getNot(element: string): string[] {
    if (element === 'senders') {
      return this.not_senders
    } else if (element === 'types') {
      return this.not_types
    } else if (element === 'rooms') {
      return this.not_rooms
    } else {
      throw new Error('Invalid element in getNot function of Filter')
    }
  }

  protected _checkFields(
    field_matchers: Record<string, (v: string) => boolean>
  ): boolean {
    for (const [name, match_func] of Object.entries(field_matchers)) {
      const disallowed_values = this.getNot(name)
      if (disallowed_values.some(match_func)) return false

      const allowed_values = this.get(name)
      if (allowed_values !== null && !allowed_values.some(match_func))
        return false
    }
    return true
  }

  public check(event: ClientEvent): boolean {
    const content = event.content || {}
    const sender = event.sender || content.user_id
    const ev_type = event.type || null
    const room_id = event.room_id || null

    const field_matchers = {
      senders: (v: string) => sender === v,
      types: (v: string) => _matchesWildcard(ev_type, v),
      rooms: (v: string) => room_id === v
    }

    const result = this._checkFields(field_matchers)
    if (!result) return false

    if (this.contains_url !== null) {
      const contains_url = typeof content.url === 'string'
      if (this.contains_url !== contains_url) return false
    }

    if (this.include_redundant_members && this.lazy_load_members) {
      if (ev_type === 'm.room.member') {
        return true
      }
    }

    return true
  }
}

// The include leave key is used to include rooms that the user has left in the sync response.
export class RoomFilter {
  public account_data: RoomEventFilter
  public ephemeral: RoomEventFilter
  public include_leave: boolean
  public not_rooms: string[]
  public rooms: string[]
  public state: RoomEventFilter
  public timeline: RoomEventFilter

  constructor(filter_json: JsonMapping) {
    this.account_data = new RoomEventFilter(filter_json.account_data)
    this.ephemeral = new RoomEventFilter(filter_json.ephemeral)
    this.include_leave = filter_json.include_leave || false
    this.not_rooms = filter_json.not_rooms || []
    this.rooms = filter_json.rooms || []
    this.state = new RoomEventFilter(filter_json.state)
    this.timeline = new RoomEventFilter(filter_json.timeline)
  }

  // Overriding method to include room field
  protected get(element: string): string[] | null {
    if (element === 'rooms') {
      return this.rooms
    } else {
      throw new Error('Invalid element in get function of Filter')
    }
  }

  // Overriding method to include room field
  protected getNot(element: string): string[] {
    if (element === 'rooms') {
      return this.not_rooms
    } else {
      throw new Error('Invalid element in getNot function of Filter')
    }
  }

  protected _checkFields(
    field_matchers: Record<string, (v: string) => boolean>
  ): boolean {
    for (const [name, match_func] of Object.entries(field_matchers)) {
      const disallowed_values = this.getNot(name)
      if (disallowed_values.some(match_func)) return false

      const allowed_values = this.get(name)
      if (allowed_values !== null && !allowed_values.some(match_func))
        return false
    }
    return true
  }

  public check(event: ClientEvent): boolean {
    const room_id = event.room_id || null

    const field_matchers = {
      rooms: (v: string) => room_id === v
    }

    const result = this._checkFields(field_matchers)
    if (!result) return false

    // check if the event is account_data, ephemeral, state, or timeline
    const event_type = getTypeRoomEvent(event.type)

    switch (event_type) {
      case 'account_data':
        return this.account_data.check(event)

      case 'ephemeral':
        return this.ephemeral.check(event)

      case 'state':
        return this.state.check(event)

      case 'timeline':
        return this.timeline.check(event)

      default:
        throw new Error('Invalid event type in RoomFilter')
    }
  }
}

// TODO : verify validity of the 2 functions below
// This function is used to get the type of event
function getTypeRoomEvent(event_type: string): string {
  const roomEvents = {
    account_data: [
      'm.tag',
      'm.push_rules',
      'm.ignored_user_list',
      'm.direct',
      'm.user_devices'
    ],
    ephemeral: [
      'm.typing',
      'm.receipt',
      'm.presence',
      'm.room.message.feedback'
    ],
    state: [
      'm.room.name',
      'm.room.topic',
      'm.room.avatar',
      'm.room.canonical_alias',
      'm.room.aliases',
      'm.room.member',
      'm.room.create',
      'm.room.join_rules',
      'm.room.power_levels',
      'm.room.history_visibility',
      'm.room.guest_access',
      'm.room.encryption',
      'm.room.server_acl',
      'm.room.third_party_invite',
      'm.room.pinned_events'
    ],
    timeline: [
      'm.room.message',
      'm.room.redaction',
      'm.call.invite',
      'm.call.candidates',
      'm.call.answer',
      'm.call.hangup',
      'm.call.reject',
      'm.reaction',
      'm.tag',
      'm.custom.event'
    ]
  }

  for (const [type, events] of Object.entries(roomEvents)) {
    if (events.includes(event_type)) {
      return type
    }
  }
  throw new Error('Invalid event type in getType')
}

function getTypeAllEvent(event_type: string): string {
  const allEvents = {
    account_data: [
      'm.push_rules',
      'm.ignored_user_list',
      'm.direct',
      'm.user_devices',
      'm.tag_order'
    ],
    presence: ['m.presence']
  }

  for (const [type, events] of Object.entries(allEvents)) {
    if (events.includes(event_type)) {
      return type
    }
  }
  return 'room'
}
