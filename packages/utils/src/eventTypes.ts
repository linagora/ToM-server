/* istanbul ignore file */

// TODO : Verify the content of this file while we implement the spec. There is absolutely no guarantee that this is correct.

export const eventTypes = {
  // State Events
  roomCreate: 'm.room.create',
  roomMember: 'm.room.member',
  roomPowerLevels: 'm.room.power_levels',
  roomJoinRules: 'm.room.join_rules',
  roomHistoryVisibility: 'm.room.history_visibility',
  roomThirdPartyInvite: 'm.room.third_party_invite',
  roomName: 'm.room.name',
  roomTopic: 'm.room.topic',
  roomAvatar: 'm.room.avatar',
  roomCanonicalAlias: 'm.room.canonical_alias',
  roomAliases: 'm.room.aliases', // Note: deprecated
  roomEncryption: 'm.room.encryption',
  roomGuestAccess: 'm.room.guest_access',
  roomServerAcl: 'm.room.server_acl',
  roomPinnedEvents: 'm.room.pinned_events',
  roomTombstone: 'm.room.tombstone',
  roomRelatedGroups: 'm.room.related_groups',
  spaceChild: 'm.space.child',
  spaceParent: 'm.space.parent',

  // Non-State Events
  roomMessage: 'm.room.message',
  roomEncrypted: 'm.room.encrypted',
  roomRedaction: 'm.room.redaction',
  reaction: 'm.reaction',
  callInvite: 'm.call.invite',
  callCandidates: 'm.call.candidates',
  callAnswer: 'm.call.answer',
  callHangup: 'm.call.hangup',
  presence: 'm.presence',
  typing: 'm.typing',
  receipt: 'm.receipt',
  direct: 'm.direct',
  pushRules: 'm.push_rules',
  sticker: 'm.sticker',
  tag: 'm.tag',
  roomMessageFeedback: 'm.room.message.feedback',
  notification: 'm.notification',
  customEvent: 'm.custom.event'
}

export const validEventTypes = Array.from(
  new Set<string>(Object.values(eventTypes))
)
