/* Lists all the regex patterns used */

export const clientSecretRegex = /^[0-9a-zA-Z.=_-]{6,255}$/
export const eventTypeRegex = /^(?:[a-z]+(?:\.[a-z][a-z0-9_]*)*)$/ // Following Java's package naming convention as per : https://spec.matrix.org/v1.11/#events
export const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
export const roomIdRegex = /^![0-9a-zA-Z._=/+-]+:[0-9a-zA-Z.-]+$/ // From : https://spec.matrix.org/v1.11/#room-structure
export const validCountryRegex = /^[A-Z]{2}$/ // ISO 3166-1 alpha-2 as per the spec : https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3registermsisdnrequesttoken
export const validPhoneNumberRegex = /^[1-9]\d{1,14}$/
