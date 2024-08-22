/* Lists all the regex patterns used */

const clientSecretRegex: RegExp = /^[0-9a-zA-Z.=_-]{6,255}$/
const eventTypeRegex: RegExp = /^(?:[a-z]+(?:\.[a-z][a-z0-9_]*)*)$/ // Following Java's package naming convention as per : https://spec.matrix.org/v1.11/#events
const matrixIdRegex: RegExp = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
const senderLocalpartRegex: RegExp = /^[a-z0-9_\-./=+]+$/
const roomIdRegex: RegExp = /^![0-9a-zA-Z._=/+-]+:[0-9a-zA-Z.-]+$/ // From : https://spec.matrix.org/v1.11/#room-structure
const sidRegex: RegExp = /^[0-9a-zA-Z.=_-]{1,255}$/
const countryRegex: RegExp = /^[A-Z]{2}$/ // ISO 3166-1 alpha-2 as per the spec : https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3registermsisdnrequesttoken
const phoneNumberRegex: RegExp = /^[1-9]\d{1,14}$/
const emailRegex: RegExp = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/
const roomAliasRegex: RegExp = /^#[a-zA-Z0-9_\-=.+]+:[a-zA-Z0-9\-.]+$/ // From : https://spec.matrix.org/v1.11/#room-structure
const hostnameRe =
  /^((([a-zA-Z0-9][-a-zA-Z0-9]*)?[a-zA-Z0-9])[.])*([a-zA-Z][-a-zA-Z0-9]*[a-zA-Z0-9]|[a-zA-Z])(:(\d+))?$/

export const isClientSecretValid = (clientSecret: string): boolean =>
  clientSecretRegex.test(clientSecret)

export const isEventTypeValid = (eventType: string): boolean =>
  eventTypeRegex.test(eventType) && Buffer.byteLength(eventType) < 256

export const isMatrixIdValid = (matrixId: string): boolean =>
  matrixIdRegex.test(matrixId) && Buffer.byteLength(matrixId) < 256

export const isSenderLocalpartValid = (senderLocalpart: string): boolean =>
  senderLocalpartRegex.test(senderLocalpart) &&
  Buffer.byteLength(senderLocalpart) < 256

export const isRoomIdValid = (roomId: string): boolean =>
  roomIdRegex.test(roomId) && Buffer.byteLength(roomId) < 256

export const isSidValid = (sid: string): boolean => sidRegex.test(sid)

export const isStateKeyValid = (stateKey: string): boolean =>
  Buffer.byteLength(stateKey) < 256

export const isCountryValid = (country: string): boolean =>
  countryRegex.test(country)

export const isPhoneNumberValid = (phoneNumber: string): boolean =>
  phoneNumberRegex.test(phoneNumber)

export const isEmailValid = (email: string): boolean => emailRegex.test(email)

export const isRoomAliasValid = (roomAlias: string): boolean =>
  roomAliasRegex.test(roomAlias)

export const isHostnameValid = (hostname: string): boolean =>
  hostnameRe.test(hostname)
