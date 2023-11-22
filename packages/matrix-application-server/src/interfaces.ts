export interface TransactionRequestBody {
  events: ClientEvent[]
}

export interface ClientEvent {
  content: Record<string, string | number | boolean>
  event_id: string
  origin_server_ts: number
  room_id: string
  sender: string
  state_key?: string
  type: string
  unsigned?: UnsignedData
}

interface UnsignedData {
  age?: number
  prev_content?: EventContent
  redacted_because?: ClientEvent
  transaction_id?: string
}

// Type from Matrix Server-Server API

/* First key represents a server name, example
    "signatures": {
      "example.com": {
        "ed25519:key_version": "a signature"
      }
    }
  */
type Signatures = Record<string, Record<string, string>>

// Interfaces from Matrix Client-Server API
interface signed {
  mxid: string
  signatures: Signatures
  token: string
}

interface Invite {
  display_name: string
  signed: signed
}

enum EMembership {
  invite = 'invite',
  join = 'join',
  knock = 'knock',
  leave = 'LEAVE',
  ban = 'ban'
}

interface EventContent {
  avatar_url?: string
  displayname?: string | null
  is_direct?: boolean
  join_authorised_via_users_server?: string
  membership: keyof typeof EMembership
  reason?: string
  third_party_invite?: Invite
}
