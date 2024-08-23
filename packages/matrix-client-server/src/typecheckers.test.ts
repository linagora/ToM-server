import {
  verifyString,
  verifyArray,
  verifyObject,
  verifyNumber,
  verifyBoolean,
  verifyUserIdentifier,
  verifyThreepidCreds,
  verifyAuthenticationData
} from './typecheckers'
import { type AuthenticationData, type UserIdentifier } from './types'

describe('Typecheck Functions', () => {
  describe('verifyString', () => {
    it('should return true for valid strings', () => {
      expect(verifyString('hello')).toBe(true)
      expect(verifyString('a'.repeat(511))).toBe(true)
    })

    it('should return false for invalid strings', () => {
      expect(verifyString('')).toBe(false)
      expect(verifyString('a'.repeat(513))).toBe(false)
      expect(verifyString(123)).toBe(false)
      expect(verifyString(null)).toBe(false)
      expect(verifyString(undefined)).toBe(false)
    })
  })

  describe('verifyArray', () => {
    it('should return true for valid arrays', () => {
      expect(verifyArray(['a', 'b', 'c'], 'string')).toBe(true)
      expect(verifyArray([1, 2, 3], 'number')).toBe(true)
    })

    it('should return false for invalid arrays', () => {
      expect(verifyArray([], 'string')).toBe(false)
      expect(verifyArray([1, 'b', 3], 'string')).toBe(false)
      expect(verifyArray('not an array', 'string')).toBe(false)
    })
  })

  describe('verifyObject', () => {
    it('should return true for valid objects', () => {
      expect(verifyObject({ key: 'value' })).toBe(true)
      expect(verifyObject({})).toBe(true)
    })

    it('should return false for invalid objects', () => {
      expect(verifyObject(null)).toBe(false)
      expect(verifyObject([])).toBe(false)
      expect(verifyObject('not an object')).toBe(false)
    })
  })

  describe('verifyNumber', () => {
    it('should return true for valid numbers', () => {
      expect(verifyNumber(123)).toBe(true)
      expect(verifyNumber(-456)).toBe(true)
    })

    it('should return false for invalid numbers', () => {
      expect(verifyNumber('not a number')).toBe(false)
      expect(verifyNumber(NaN)).toBe(false)
    })
  })

  describe('verifyBoolean', () => {
    it('should return true for valid booleans', () => {
      expect(verifyBoolean(true)).toBe(true)
      expect(verifyBoolean(false)).toBe(true)
    })

    it('should return false for invalid booleans', () => {
      expect(verifyBoolean('true')).toBe(false)
      expect(verifyBoolean(1)).toBe(false)
    })
  })

  describe('verifyUserIdentifier', () => {
    it('should return true for valid MatrixIdentifier', () => {
      const identifier = { type: 'm.id.user', user: '@user:matrix.org' }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(true)
    })

    it('should return false for invalid MatrixIdentifier', () => {
      const identifier = { type: 'm.id.user', user: 'invalidUser' }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(false)
    })

    it('should return true for valid ThirdPartyIdentifier', () => {
      const identifier = {
        type: 'm.id.thirdparty',
        medium: 'email',
        address: 'user@example.com'
      }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(true)
    })

    it('should return false for invalid ThirdPartyIdentifier', () => {
      const identifier = {
        type: 'm.id.thirdparty',
        medium: 'email',
        address: 'invalidEmail'
      }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(false)
    })

    it('should return true for valid PhoneIdentifier', () => {
      const identifier = {
        type: 'm.id.phone',
        country: 'US',
        phone: '1234567890'
      }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(true)
    })

    it('should return false for invalid PhoneIdentifier', () => {
      const identifier = {
        type: 'm.id.phone',
        country: 'US',
        phone: 'invalidPhone'
      }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(false)
    })
    it('should return false for invalid UserIdentifier', () => {
      const identifier = {
        type: 'm.id.invalid'
      }
      expect(verifyUserIdentifier(identifier as UserIdentifier)).toBe(false)
    })
  })

  describe('verifyThreepidCreds', () => {
    it('should return true for valid ThreepidCreds', () => {
      const creds = { sid: 'sid123', client_secret: 'secret' }
      expect(verifyThreepidCreds(creds)).toBe(true)
    })

    it('should return false for invalid ThreepidCreds', () => {
      const creds = { sid: 'sid123', client_secret: '' } // Invalid client_secret
      expect(verifyThreepidCreds(creds)).toBe(false)
    })
  })

  describe('verifyAuthenticationData', () => {
    it('should return true for valid PasswordAuth', () => {
      const authData = {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: '@user:matrix.org' },
        password: 'password123',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid PasswordAuth', () => {
      const authData = {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: 'invalidUser' }, // Invalid user ID
        password: 'password123',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return true for valid EmailAuth', () => {
      const authData = {
        type: 'm.login.email.identity',
        threepid_creds: { sid: 'sid123', client_secret: 'secret' },
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid EmailAuth', () => {
      const authData = {
        type: 'm.login.email.identity',
        threepid_creds: { sid: '', client_secret: 'secret' }, // Invalid sid
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })
    it('should return true for valid RecaptchaAuth', () => {
      const authData = {
        type: 'm.login.recaptcha',
        response: 'recaptchaResponse',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid RecaptchaAuth (missing session)', () => {
      const authData = {
        type: 'm.login.recaptcha',
        response: 'recaptchaResponse'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return false for invalid RecaptchaAuth (empty response)', () => {
      const authData = {
        type: 'm.login.recaptcha',
        response: '',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return true for valid SsoAuth', () => {
      const authData = {
        type: 'm.login.sso',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid SsoAuth (missing session)', () => {
      const authData = {
        type: 'm.login.sso'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return true for valid DummyAuth', () => {
      const authData = {
        type: 'm.login.dummy',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid DummyAuth (empty session)', () => {
      const authData = {
        type: 'm.login.dummy',
        session: ''
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return true for valid TokenAuth', () => {
      const authData = {
        type: 'm.login.registration_token',
        token: 'registrationToken',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid TokenAuth (missing token)', () => {
      const authData = {
        type: 'm.login.registration_token',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return true for valid ApplicationServiceAuth', () => {
      const authData = {
        type: 'm.login.application_service',
        username: 'user123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        true
      )
    })

    it('should return false for invalid ApplicationServiceAuth (missing username)', () => {
      const authData = {
        type: 'm.login.application_service'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })

    it('should return false for invalid AuthenticationData (unknown type)', () => {
      const authData = {
        type: 'm.login.unknown',
        session: 'session123'
      }
      expect(verifyAuthenticationData(authData as AuthenticationData)).toBe(
        false
      )
    })
  })
})
