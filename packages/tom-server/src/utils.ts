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
    'id varchar(64) PRIMARY KEY, sender varchar(64), recepient varchar(64), medium varchar(64), expiration varchar(64), accessed int, room_id varchar(64)',
  addressbooks: 'id varchar(64) PRIMARY KEY, owner varchar(64)',
  contacts:
    'id varchar(64) PRIMARY KEY, addressbook_id varchar(64), mxid: varchar(64), display_name: string, active int'
}

/**
 * Builds a URL from a base URL and a path
 *
 * @param {string} base - Base URL
 * @param {string} path - Path
 * @returns {string} - URL
 */
export const buildUrl = (base: string, path: string): string => {
  let formattedUrl = base

  if (
    !formattedUrl.startsWith('https://') &&
    !formattedUrl.startsWith('http://')
  ) {
    formattedUrl = `https://${formattedUrl}`
  }

  const url = new URL(formattedUrl)

  url.pathname = path

  return url.toString()
}
