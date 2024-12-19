export const tables = {
  recoveryWords: 'userId text PRIMARY KEY, words TEXT',
  matrixTokens: 'id varchar(64) PRIMARY KEY, data text',
  privateNotes:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, targetId varchar(64)',
  roomTags:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, roomId varchar(64)',
  userQuotas: 'user_id varchar(64) PRIMARY KEY, size int',
  rooms: 'id varchar(64) PRIMARY KEY, filter varchar(64)',
  invitations:
    'id varchar(64) PRIMARY KEY, sender varchar(64), recepient varchar(64), medium varchar(64), expiration int, accessed int'
}
