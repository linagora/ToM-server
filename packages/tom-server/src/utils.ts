export const tables = {
  recoveryWords: 'userId text PRIMARY KEY, words TEXT',
  matrixTokens: 'id varchar(64) PRIMARY KEY, data text',
  userQuotas: 'user_id varchar(64) PRIMARY KEY, size int',
  rooms: 'id varchar(64) PRIMARY KEY, filter varchar(64)',
  invitations:
    'id varchar(64) PRIMARY KEY, sender varchar(64), recipient varchar(64), medium varchar(64), expiration varchar(64), accessed int, room_id varchar(64), matrix_id varchar(64)',
  addressbooks: 'id varchar(64) PRIMARY KEY, owner varchar(64)',
  contacts:
    'id varchar(64) PRIMARY KEY, addressbook_id varchar(64), mxid varchar(64), display_name varchar(64), active int',
  usersettings:
    "matrix_id varchar(64) PRIMARY KEY, settings jsonb, version int DEFAULT 1, timestamp bigint DEFAULT 0, request_id varchar(255) DEFAULT ''",
  profileSettings:
    'matrix_id varchar(64) PRIMARY KEY, visibility VARCHAR(20) NOT NULL, visible_fields TEXT[] NOT NULL'
}

/**
 * Builds a URL from a base URL and a path
 *
 * @param {string} base - Base URL
 * @param {string} path - Path
 * @returns {string} - URL
 */
/**
 * Builds a URL from a base URL and a path
 *
 * @param {string} base - Base URL
 * @param {string} path - Path
 * @returns {string} - Combined URL
 */
export const buildUrl = (base: string, path: string): string => {
  let formattedUrl = base

  if (
    !formattedUrl.startsWith('https://') &&
    !formattedUrl.startsWith('http://')
  ) {
    formattedUrl = `https://${formattedUrl}`
  }

  const baseUrl = new URL(formattedUrl)

  if (!baseUrl.pathname.endsWith('/')) {
    baseUrl.pathname += '/'
  }

  const processedPath = path.startsWith('/') ? path.slice(1) : path
  const finalUrl = new URL(processedPath, baseUrl.href)

  return finalUrl.toString()
}
