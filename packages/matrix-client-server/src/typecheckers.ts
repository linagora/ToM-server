import {
  isClientSecretValid,
  isCountryValid,
  isEmailValid,
  isMatrixIdValid,
  isPhoneNumberValid,
  isSidValid
} from '@twake/utils'
import {
  type AuthenticationData,
  type ThreepidCreds,
  type UserIdentifier
} from './types'

const MAX_STRINGS_LENGTH = 512 // Arbitrary value, could be changed

export const verifyString = (value: any): boolean => {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length < MAX_STRINGS_LENGTH
  )
}

export const verifyArray = (value: any, expectedType: string): boolean => {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }
  // eslint-disable-next-line valid-typeof
  return value.every((element) => typeof element === expectedType)
}
export const verifyObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value) // Since typeof returns 'object' for arrays, we need to check that it's not an array
}

export const verifyNumber = (value: any): boolean => {
  return (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    value.toString().length < MAX_STRINGS_LENGTH // Again arbitrary check so that the numbers aren't absurdly large
  )
}

export const verifyBoolean = (value: any): boolean => {
  return typeof value === 'boolean'
}

// Function to validate UserIdentifier
export const verifyUserIdentifier = (identifier: UserIdentifier): boolean => {
  if (!verifyObject(identifier)) return false

  switch (identifier.type) {
    case 'm.id.user':
      return isMatrixIdValid(identifier.user)

    case 'm.id.thirdparty':
      return (
        (identifier.medium === 'msisdn' &&
          isPhoneNumberValid(identifier.address)) ||
        (identifier.medium === 'email' && isEmailValid(identifier.address))
      )

    case 'm.id.phone':
      return (
        isCountryValid(identifier.country) &&
        isPhoneNumberValid(identifier.phone)
      )

    default:
      return false
  }
}

// Function to validate ThreepidCreds
export const verifyThreepidCreds = (creds: ThreepidCreds): boolean => {
  return (
    isSidValid(creds.sid) &&
    isClientSecretValid(creds.client_secret) &&
    (creds.id_server === undefined || verifyString(creds.id_server)) &&
    (creds.id_access_token === undefined || verifyString(creds.id_access_token))
  )
}

// Main function to validate AuthenticationData
export const verifyAuthenticationData = (
  authData: AuthenticationData
): boolean => {
  if (!verifyObject(authData)) return false

  switch (authData.type) {
    case 'm.login.password':
      return (
        verifyUserIdentifier(authData.identifier) &&
        verifyString(authData.password) &&
        verifyString(authData.session)
      )

    case 'm.login.email.identity':
    case 'm.login.msisdn':
      return (
        verifyThreepidCreds(authData.threepid_creds) &&
        verifyString(authData.session)
      )

    case 'm.login.recaptcha':
      return verifyString(authData.response) && verifyString(authData.session)

    case 'm.login.sso':
    case 'm.login.dummy':
    case 'm.login.terms':
      return verifyString(authData.session)

    case 'm.login.registration_token':
      return verifyString(authData.token) && verifyString(authData.session)

    case 'm.login.application_service':
      return verifyString(authData.username) // Could be userId or localpart according to spec so we only check if it's a string : https://spec.matrix.org/v1.11/client-server-api/#appservice-login
    default:
      return false
  }
}
