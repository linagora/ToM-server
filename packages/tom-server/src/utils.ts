export const tables = {
  recoveryWords: 'userId text PRIMARY KEY, words TEXT',
  matrixTokens: 'id varchar(64) PRIMARY KEY, data text',
  privateNotes:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, targetId varchar(64)',
  roomTags:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, roomId varchar(64)',
  userQuotas: 'user_id varchar(64) PRIMARY KEY, size int',
  rooms: 'id varchar(64) PRIMARY KEY, filter varchar(64)'
}
