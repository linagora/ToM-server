import { type TwakeLogger } from '@twake/logger'
import { DbGetResult, MatrixDB, UserDB } from '@twake/matrix-identity-server'
import { IAddressbookService } from '../../addressbook-api/types'
import type { Config, TwakeDB } from '../../types'
import UserInfoService from '../services'
import {
  ProfileField,
  ProfileVisibility,
  type UserProfileSettingsPayloadT,
  type UserInformation,
  UserProfileSettingsT
} from '../types'

const BASE_CONFIG = {
  userdb_engine: 'ldap',
  ldap_uri: 'ldap://localhost:63389',
  ldap_base: 'ou=users,o=example',
  additional_features: true,
  features: {
    common_settings: { enabled: false },
    user_profile: {
      default_visibility_settings: {
        visibility: 'private',
        visible_fields: []
      }
    }
  }
}

const MATRIX_MXID: string = '@dwho:docker.localhost'

const MOCK_DATA = {
  MATRIX: {
    displayname: 'Matrix Display Name',
    avatar_url: 'matrix_avatar_url'
  },
  LDAP: {
    cn: 'LDAP CN Name',
    sn: 'LDAP Last Name',
    givenName: 'LDAP First Name',
    mail: 'ldap@example.org',
    mobile: '+1 555 123 4567'
  },
  COMMON_SETTINGS: {
    display_name: 'CS Display Name',
    first_name: 'CS First Name',
    last_name: 'CS Last Name',
    language: 'es',
    timezone: 'Europe/Madrid',
    email: 'cs@example.com',
    phone: '+1 999 888 7777'
  },
  ADDRESSBOOK: {
    display_name: 'AB Display Name'
  }
}

type LoggerWithoutTrace = Omit<TwakeLogger, 'trace'>
const loggerMock: jest.Mocked<LoggerWithoutTrace> = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
  close: jest.fn()
} as unknown as jest.Mocked<LoggerWithoutTrace> // Need cast due to complex Omit type usage

type UserDBMinimal = UserDB
const userDBMock: jest.Mocked<UserDBMinimal> = {
  get: jest.fn()
} as unknown as jest.Mocked<UserDBMinimal>
type useProfileTwake = {
  displayName: boolean
  lastName: boolean
  givenName: boolean
  mail: boolean
  phone: boolean
}
const useProfileTwakeDefaults: useProfileTwake = {
  displayName: false,
  lastName: false,
  givenName: false,
  mail: false,
  phone: false
}
/**
 * Configure Matrix mock response.
 * @param useProfile If true, returns full mock profile. If false, returns empty array.
 */
const mockUserDB = (
  useProfile: Partial<useProfileTwake> = useProfileTwakeDefaults
) => {
  return ((
    useProfileDefaults: useProfileTwake = {
      ...useProfileTwakeDefaults,
      ...useProfile
    }
  ) => {
    userDBMock.get.mockClear()
    if (Object.values(useProfileDefaults).every((v) => !v)) {
      userDBMock.get.mockResolvedValue([])
    } else {
      const { displayName, lastName, givenName, mail, phone } =
        useProfileDefaults
      const profile = {}

      if (displayName)
        Object.defineProperty(profile, 'cn', {
          value: MOCK_DATA.LDAP.cn,
          writable: false
        })
      if (lastName)
        Object.defineProperty(profile, 'sn', {
          value: MOCK_DATA.LDAP.sn,
          writable: false
        })
      if (givenName)
        Object.defineProperty(
          profile,
          (Math.floor(Math.random() * (100 - 0 + 1)) + 0) % 2
            ? 'givenname'
            : 'givenName',
          { value: MOCK_DATA.LDAP.givenName, writable: false }
        )
      if (mail)
        Object.defineProperty(profile, 'mail', {
          value: MOCK_DATA.LDAP.mail,
          writable: false
        })
      if (phone)
        Object.defineProperty(profile, 'mobile', {
          value: MOCK_DATA.LDAP.mobile,
          writable: false
        })

      userDBMock.get.mockResolvedValue([profile])
    }
  })()
}

type TwakeDBMinimal = Omit<TwakeDB, 'delete'>
const twakeDBMock: jest.Mocked<TwakeDBMinimal> = {
  get: jest.fn(),
  insert: jest.fn().mockImplementation(async (table, values) => {
    if (table === 'profileSettings') {
      return [{ ...values }]
    }
    return []
  }),
  update: jest.fn(),
  query: jest.fn(),
  count: jest.fn(),
  db: {} as any,
  raw: jest.fn()
} as unknown as jest.Mocked<TwakeDBMinimal>
type useProfileCommonSettings = {
  displayName: boolean
  lastName: boolean
  firstName: boolean
  mail: boolean
  phone: boolean
  language: boolean
  timezone: boolean
}
const useProfileCommonSettingsDefaults: useProfileCommonSettings = {
  displayName: false,
  lastName: false,
  firstName: false,
  mail: false,
  phone: false,
  language: false,
  timezone: false
}
/**
 * Configure TwakeDB mock response for common settings and profile settings.
 * @param enabled If true, returns mock common settings. If false, returns empty array.
 */
const mockTwakeDB = (
  useProfile: Partial<useProfileCommonSettings> = useProfileCommonSettingsDefaults,
  useProfileSettings: UserProfileSettingsT | null = null
) => {
  return ((
    useProfileDefaults: useProfileCommonSettings = {
      ...useProfileCommonSettingsDefaults,
      ...useProfile
    }
  ) => {
    twakeDBMock.get.mockClear()
    twakeDBMock.get.mockImplementation(
      async (table, fields, filterFields, order?): Promise<DbGetResult> => {
        let r
        switch (table) {
          case 'usersettings':
            if (Object.values(useProfileDefaults).every((v) => !v)) return []
            const {
              displayName,
              lastName,
              firstName,
              mail,
              phone,
              language,
              timezone
            } = useProfileDefaults
            const profile = {}

            if (displayName)
              Object.defineProperty(profile, 'display_name', {
                value: MOCK_DATA.COMMON_SETTINGS.display_name
              })
            if (lastName)
              Object.defineProperty(profile, 'last_name', {
                value: MOCK_DATA.COMMON_SETTINGS.last_name,
                writable: false
              })
            if (firstName)
              Object.defineProperty(profile, 'first_name', {
                value: MOCK_DATA.COMMON_SETTINGS.first_name,
                writable: false
              })
            if (mail)
              Object.defineProperty(profile, 'email', {
                value: MOCK_DATA.COMMON_SETTINGS.email,
                writable: false
              })
            if (phone)
              Object.defineProperty(profile, 'phone', {
                value: MOCK_DATA.COMMON_SETTINGS.phone,
                writable: false
              })
            if (language)
              Object.defineProperty(profile, 'language', {
                value: MOCK_DATA.COMMON_SETTINGS.language,
                writable: false
              })
            if (timezone)
              Object.defineProperty(profile, 'timezone', {
                value: MOCK_DATA.COMMON_SETTINGS.timezone,
                writable: false
              })
            return [{ settings: profile }] as unknown as DbGetResult
          case 'profileSettings':
            return useProfileSettings ? [{ ...useProfileSettings }] : []
          default:
            return []
        }
      }
    )
  })()
}

type MatrixDBMinimal = Omit<MatrixDB, 'set'>
const matrixDBMock: jest.Mocked<MatrixDBMinimal> = {
  get: jest.fn(),
  delete: jest.fn()
} as unknown as jest.Mocked<MatrixDBMinimal>
type useProfileMatrix = { displayName: boolean; avatar: boolean }
const useProfileMatrixDefaults: useProfileMatrix = {
  displayName: false,
  avatar: false
}
/**
 * Configure Matrix mock response.
 * @param useProfile If true, returns full mock profile. If false, returns empty array.
 */
const mockMatrix = (
  useProfile: Partial<useProfileMatrix> = useProfileMatrixDefaults
) => {
  return ((
    useProfileDefaults: useProfileMatrix = {
      ...useProfileMatrixDefaults,
      ...useProfile
    }
  ) => {
    matrixDBMock.get.mockClear()

    if (Object.values(useProfileDefaults).every((v) => !v)) {
      matrixDBMock.get.mockResolvedValue([])
    } else {
      const { displayName, avatar } = useProfileDefaults
      const profile = {}

      if (displayName)
        Object.defineProperty(profile, 'displayname', {
          value: MOCK_DATA.MATRIX.displayname,
          writable: false
        })
      if (avatar)
        Object.defineProperty(profile, 'avatar_url', {
          value: MOCK_DATA.MATRIX.avatar_url,
          writable: false
        })

      matrixDBMock.get.mockResolvedValue([profile])
    }
  })()
}

const addressBookServiceMock = {
  list: jest.fn()
}
type useProfileAddressBook = { displayName: boolean }
const useProfileAddressBookDefaults: useProfileAddressBook = {
  displayName: false
}
/**
 * Configure Addressbook mock response for a specific contact.
 * @param hasContact If true, the addressbook contains the target MXID with the mock AB name.
 */
const mockAddressBook = (
  useProfile: Partial<useProfileAddressBook> = useProfileAddressBookDefaults
) => {
  return ((
    useProfileDefaults: useProfileAddressBook = {
      ...useProfileAddressBookDefaults,
      ...useProfile
    }
  ) => {
    addressBookServiceMock.list.mockClear()

    if (Object.values(useProfileDefaults).every((v) => !v)) {
      addressBookServiceMock.list.mockResolvedValue(null)
    } else {
      addressBookServiceMock.list.mockResolvedValue({
        contacts: [
          {
            mxid: MATRIX_MXID,
            display_name: MOCK_DATA.ADDRESSBOOK.display_name
          }
        ]
      })
    }
  })()
}

/**
 * Creates a new service instance with specific feature flags.
 * @param additionalFeatures Enables/Disables Directory lookup logic.
 * @param commonSettingsEnabled Enables/Disables Common Settings aggregation.
 */
const createService = (
  additionalFeatures: boolean,
  commonSettingsEnabled: boolean
) => {
  const cfg = {
    ...BASE_CONFIG,
    additional_features: additionalFeatures,
    features: {
      ...BASE_CONFIG.features,
      common_settings: { enabled: commonSettingsEnabled }
    }
  } as unknown as Config

  const svc = new UserInfoService(
    userDBMock as unknown as UserDB,
    twakeDBMock as unknown as TwakeDB,
    matrixDBMock as unknown as MatrixDB,
    cfg,
    loggerMock as unknown as TwakeLogger
  )

  ;(svc as any).addressBookService =
    addressBookServiceMock as unknown as IAddressbookService

  return svc
}

beforeEach(() => {
  jest.clearAllMocks()
  mockMatrix()
  mockUserDB()
  mockTwakeDB()
  mockAddressBook()
})

describe('User Info Service GET with: No feature flags ON', () => {
  const svc = createService(false, false)
  describe('When no viewer is provided', () => {
    afterEach(() => {
      // When no viewer ToM cannot lookup the address book
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return null when no records found at all', async () => {
      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return null even if UserDB has a record', async () => {
      mockUserDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return only display name if only MatrixDB has a record', async () => {
      mockMatrix({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should return display name and avatar only if only MatrixDB has a record and is full', async () => {
      mockMatrix({ displayName: true, avatar: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if UserDB has a record too - 1', async () => {
      mockMatrix({ displayName: true })
      mockUserDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if UserDB has a record too - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should add UserDB fields but display name - 1', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true, lastName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should add UserDB fields but display name - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true, lastName: true, givenName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    describe('While honoring Profile Visibility: Default (Private + No fields)', () => {
      it('Should add UserDB fields but display name - 3', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true
        })

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should add UserDB fields but display name - 4', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })

    describe('While honoring Profile Visibility: Private', () => {
      describe('And honoring field visibility: None', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    // Same as Private as viewer is unknown
    describe('While honoring Profile Visibility: Contacts', () => {
      describe('And honoring field visibility: None', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    describe('While honoring Profile Visibility: Public', () => {
      describe('And honoring field visibility: None', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    it('Should NOT overwrite MatrixDB fields if Common Settings has a record too - 1', async () => {
      mockMatrix({ displayName: true })
      mockTwakeDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if Common Settings has a record too - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT add Common Settings fields but display name - 1', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true, lastName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT add Common Settings fields but display name - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true, lastName: true, firstName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    describe('While honoring Profile Visibility: Default (Private + No fields)', () => {
      it('Should NOT add Common Settings fields but display name - 3', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB({
          displayName: true,
          lastName: true,
          firstName: true,
          mail: true
        })

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).not.toHaveProperty('sn')
        expect(user).not.toHaveProperty('givenName')
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).not.toHaveProperty('last_name')
        expect(user).not.toHaveProperty('first_name')
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should NOT add Common Settings fields but display name - 4', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB({
          displayName: true,
          lastName: true,
          firstName: true,
          mail: true,
          phone: true
        })

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).not.toHaveProperty('sn')
        expect(user).not.toHaveProperty('givenName')
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).not.toHaveProperty('last_name')
        expect(user).not.toHaveProperty('first_name')
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })

    describe('While honoring Profile Visibility: Private', () => {
      describe('And honoring field visibility: None', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    // Same as Private as viewer is unknown
    describe('While honoring Profile Visibility: Contacts', () => {
      describe('And honoring field visibility: None', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    describe('While honoring Profile Visibility: Public', () => {
      describe('And honoring field visibility: None', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    it('Should NOT add Common Settings fields but display name - 5', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        language: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT add Common Settings fields but display name - 6', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        language: true,
        timezone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })
  })

  describe('When viewer is target', () => {
    afterEach(() => {
      // When no viewer ToM cannot lookup the address book
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return null when no records found at all', async () => {
      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return null even if UserDB has a record', async () => {
      mockUserDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return only display name if only MatrixDB has a record', async () => {
      mockMatrix({ displayName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should return display name and avatar only if only MatrixDB has a record and is full', async () => {
      mockMatrix({ displayName: true, avatar: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if UserDB has a record too - 1', async () => {
      mockMatrix({ displayName: true })
      mockUserDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if UserDB has a record too - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should add UserDB fields but display name - 1', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true, lastName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should add UserDB fields but display name - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true, lastName: true, givenName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    describe('While honoring Profile Visibility: Default (Private + No fields)', () => {
      it('Should add UserDB fields but display name - 3', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true
        })

        const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should add UserDB fields but display name - 4', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })

        const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })

    describe('While honoring Profile Visibility: Private', () => {
      describe('And honoring field visibility: None', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    // Same as Private as viewer is unknown
    describe('While honoring Profile Visibility: Contacts', () => {
      describe('And honoring field visibility: None', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    describe('While honoring Profile Visibility: Public', () => {
      describe('And honoring field visibility: None', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should add UserDB fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should add UserDB fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    it('Should NOT overwrite MatrixDB fields if Common Settings has a record too - 1', async () => {
      mockMatrix({ displayName: true })
      mockTwakeDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if Common Settings has a record too - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT add Common Settings fields but display name - 1', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true, lastName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT add Common Settings fields but display name - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true, lastName: true, firstName: true })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    describe('While honoring Profile Visibility: Default (Private + No fields)', () => {
      it('Should NOT add Common Settings fields but display name - 3', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB({
          displayName: true,
          lastName: true,
          firstName: true,
          mail: true
        })

        const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).not.toHaveProperty('sn')
        expect(user).not.toHaveProperty('givenName')
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).not.toHaveProperty('last_name')
        expect(user).not.toHaveProperty('first_name')
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should NOT add Common Settings fields but display name - 4', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB({
          displayName: true,
          lastName: true,
          firstName: true,
          mail: true,
          phone: true
        })

        const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).not.toHaveProperty('sn')
        expect(user).not.toHaveProperty('givenName')
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).not.toHaveProperty('last_name')
        expect(user).not.toHaveProperty('first_name')
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })

    describe('While honoring Profile Visibility: Private', () => {
      describe('And honoring field visibility: None', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Private,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    // Same as Private as viewer is unknown
    describe('While honoring Profile Visibility: Contacts', () => {
      describe('And honoring field visibility: None', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    describe('While honoring Profile Visibility: Public', () => {
      describe('And honoring field visibility: None', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: []
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both', () => {
        it('Should NOT add Common Settings fields but display name - 3', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })

        it('Should NOT add Common Settings fields but display name - 4', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockTwakeDB(
            {
              displayName: true,
              lastName: true,
              firstName: true,
              mail: true,
              phone: true
            },
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Public,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).not.toHaveProperty('sn')
          expect(user).not.toHaveProperty('givenName')
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).not.toHaveProperty('last_name')
          expect(user).not.toHaveProperty('first_name')
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    it('Should NOT add Common Settings fields but display name - 5', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        language: true
      })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT add Common Settings fields but display name - 6', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        language: true,
        timezone: true
      })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })
  })

  describe('When viewer has different contact relationships with target', () => {
    const VIEWER_MXID: string = '@viewer:docker.localhost'

    afterEach(() => {
      // Verify addressbook service was called when viewer is provided
      if (VIEWER_MXID !== MATRIX_MXID) {
        expect(addressBookServiceMock.list).toHaveBeenCalledWith(VIEWER_MXID)
      }
    })

    describe('Profile Visibility: Contacts - Viewer IS in target contacts', () => {
      beforeEach(() => {
        // Mock that viewer is in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [{ mxid: VIEWER_MXID, display_name: 'Viewer Name' }]
              }
            }
            return { contacts: [] }
          }
        )
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should show email field when viewer is in contacts', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should show phone field when viewer is in contacts', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both Email and Phone', () => {
        it('Should show both email and phone fields when viewer is in contacts', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    describe('Profile Visibility: Contacts - Viewer NOT in target contacts', () => {
      beforeEach(() => {
        // Mock that viewer is NOT in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [
                  {
                    mxid: '@someone_else:docker.localhost',
                    display_name: 'Other User'
                  }
                ]
              }
            }
            return { contacts: [] }
          }
        )
      })

      describe('And honoring field visibility: Email only', () => {
        it('Should NOT show email field when viewer is not in contacts', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email]
            }
          )

          const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Phone only', () => {
        it('Should NOT show phone field when viewer is not in contacts', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })

      describe('And honoring field visibility: Both Email and Phone', () => {
        it('Should NOT show email or phone fields when viewer is not in contacts', async () => {
          mockMatrix({ displayName: true, avatar: true })
          mockUserDB({
            displayName: true,
            lastName: true,
            givenName: true,
            mail: true,
            phone: true
          })
          mockTwakeDB(
            {},
            {
              matrix_id: MATRIX_MXID,
              visibility: ProfileVisibility.Contacts,
              visible_fields: [ProfileField.Email, ProfileField.Phone]
            }
          )

          const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('emails')
          expect(user).not.toHaveProperty('phones')
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })

    describe('Profile Visibility: Public - Contact relationship should not matter', () => {
      beforeEach(() => {
        // Mock that viewer is NOT in target's contacts (but shouldn't matter for Public)
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [
                  {
                    mxid: '@someone_else:docker.localhost',
                    display_name: 'Other User'
                  }
                ]
              }
            }
            return { contacts: [] }
          }
        )
      })

      it('Should show email field even when viewer is not in contacts (Public profile)', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Public,
            visible_fields: [ProfileField.Email]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should show both email and phone fields even when viewer is not in contacts (Public profile)', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Public,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })
  })
})

describe('User Info Service GET with: Additional features ON, Common settings OFF', () => {
  const svc = createService(true, false)
  describe('When no viewer is provided', () => {
    afterEach(() => {
      // When no viewer ToM cannot lookup the address book
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return user info even when no Matrix profile exists (additional_features enables directory-only lookup)', async () => {
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.LDAP.cn)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should return null when no records found at all (even with additional_features)', async () => {
      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should merge Matrix and Directory data when both exist', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    describe('While honoring Profile Visibility: Public with email visible', () => {
      it('Should show email field when profile is Public', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Public,
            visible_fields: [ProfileField.Email]
          }
        )

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should show both email and phone fields when profile is Public', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Public,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })
  })

  describe('When viewer is target (viewing own profile)', () => {
    afterEach(() => {
      // When viewer equals target, addressbook is not called
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return user info even when no Matrix profile exists (directory-only)', async () => {
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.LDAP.cn)
      expect(user).not.toHaveProperty('avatar_url')
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should show all fields when viewing own profile (ignores visibility settings)', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: []
        }
      )

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })
  })

  describe('When viewer has contact relationship with target', () => {
    const VIEWER_MXID = '@viewer:docker.localhost'

    describe('Profile Visibility: Contacts - Viewer IS in target contacts', () => {
      beforeEach(() => {
        // Mock that viewer is in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [{ mxid: VIEWER_MXID, display_name: 'Viewer Name' }]
              }
            }
            return { contacts: [] }
          }
        )
      })

      it('Should show visible fields when viewer is in contacts (additional_features enabled)', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Contacts,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should return directory-only profile when no Matrix profile exists but viewer is in contacts', async () => {
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Contacts,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty('display_name', MOCK_DATA.LDAP.cn)
        expect(user).not.toHaveProperty('avatar_url')
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
        expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })

    describe('Profile Visibility: Contacts - Viewer NOT in target contacts', () => {
      beforeEach(() => {
        // Mock that viewer is NOT in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [
                  {
                    mxid: '@someone_else:docker.localhost',
                    display_name: 'Other User'
                  }
                ]
              }
            }
            return { contacts: [] }
          }
        )
      })

      it('Should hide contact fields but still return profile when additional_features enabled', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Contacts,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })

    describe('Profile Visibility: Private - Should always hide contact fields', () => {
      beforeEach(() => {
        // Mock that viewer is NOT in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            return { contacts: [] }
          }
        )
      })

      it('Should hide all contact fields even when additional_features enabled', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockUserDB({
          displayName: true,
          lastName: true,
          givenName: true,
          mail: true,
          phone: true
        })
        mockTwakeDB(
          {},
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Private,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })
    })
  })
})

describe('User Info Service GET with: Additional features OFF, Common settings ON', () => {
  const svc = createService(false, true)
  describe('When no viewer is provided', () => {
    afterEach(() => {
      // When no viewer ToM cannot lookup the address book
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return null when no Matrix profile exists (additional_features disabled)', async () => {
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        mail: true,
        phone: true,
        language: true,
        timezone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should merge Matrix and Common Settings data when Matrix profile exists', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        mail: true,
        phone: true,
        language: true,
        timezone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })

    it('Should prefer Common Settings display_name over Matrix displayname', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true, lastName: true, firstName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    describe('While honoring Profile Visibility: Public with email/phone visible', () => {
      it('Should show email from Common Settings when profile is Public', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB(
          {
            displayName: true,
            lastName: true,
            firstName: true,
            mail: true,
            phone: true
          },
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Public,
            visible_fields: [ProfileField.Email]
          }
        )

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.COMMON_SETTINGS.display_name
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
        expect(user).toHaveProperty(
          'givenName',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty('emails', [MOCK_DATA.COMMON_SETTINGS.email])
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty(
          'last_name',
          MOCK_DATA.COMMON_SETTINGS.last_name
        )
        expect(user).toHaveProperty(
          'first_name',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).not.toHaveProperty('language')
        expect(user).not.toHaveProperty('timezone')
      })

      it('Should show both email and phone from Common Settings when profile is Public', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB(
          {
            displayName: true,
            lastName: true,
            firstName: true,
            mail: true,
            phone: true,
            language: true,
            timezone: true
          },
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Public,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.COMMON_SETTINGS.display_name
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
        expect(user).toHaveProperty(
          'givenName',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty('emails', [MOCK_DATA.COMMON_SETTINGS.email])
        expect(user).toHaveProperty('phones', [MOCK_DATA.COMMON_SETTINGS.phone])
        expect(user).toHaveProperty(
          'last_name',
          MOCK_DATA.COMMON_SETTINGS.last_name
        )
        expect(user).toHaveProperty(
          'first_name',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty(
          'language',
          MOCK_DATA.COMMON_SETTINGS.language
        )
        expect(user).toHaveProperty(
          'timezone',
          MOCK_DATA.COMMON_SETTINGS.timezone
        )
      })
    })

    describe('While honoring Profile Visibility: Private (should hide email/phone)', () => {
      it('Should hide email from Common Settings when profile is Private', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB(
          {
            displayName: true,
            lastName: true,
            firstName: true,
            mail: true,
            phone: true,
            language: true,
            timezone: true
          },
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Private,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.COMMON_SETTINGS.display_name
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
        expect(user).toHaveProperty(
          'givenName',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty(
          'last_name',
          MOCK_DATA.COMMON_SETTINGS.last_name
        )
        expect(user).toHaveProperty(
          'first_name',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty(
          'language',
          MOCK_DATA.COMMON_SETTINGS.language
        )
        expect(user).toHaveProperty(
          'timezone',
          MOCK_DATA.COMMON_SETTINGS.timezone
        )
      })
    })
  })

  describe('When viewer is target (viewing own profile)', () => {
    afterEach(() => {
      // When viewer equals target, addressbook is not called
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should show all Common Settings fields when viewing own profile', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB(
        {
          displayName: true,
          lastName: true,
          firstName: true,
          mail: true,
          phone: true,
          language: true,
          timezone: true
        },
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: []
        }
      )

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty('emails', [MOCK_DATA.COMMON_SETTINGS.email])
      expect(user).toHaveProperty('phones', [MOCK_DATA.COMMON_SETTINGS.phone])
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })

    it('Should return null when Matrix missing and additional_features disabled', async () => {
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        mail: true,
        phone: true,
        language: true,
        timezone: true
      })

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      // Should return null because additional_features is false and no Matrix profile
      expect(user).toBeNull()
    })
  })

  describe('When viewer has contact relationship with target', () => {
    const VIEWER_MXID = '@viewer:docker.localhost'

    describe('Profile Visibility: Contacts - Viewer IS in target contacts', () => {
      beforeEach(() => {
        // Mock that viewer is in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [{ mxid: VIEWER_MXID, display_name: 'Viewer Name' }]
              }
            }
            return { contacts: [] }
          }
        )
      })

      it('Should show Common Settings email/phone when viewer is in contacts', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB(
          {
            displayName: true,
            lastName: true,
            firstName: true,
            mail: true,
            phone: true,
            language: true,
            timezone: true
          },
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Contacts,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.COMMON_SETTINGS.display_name
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
        expect(user).toHaveProperty(
          'givenName',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty('emails', [MOCK_DATA.COMMON_SETTINGS.email])
        expect(user).toHaveProperty('phones', [MOCK_DATA.COMMON_SETTINGS.phone])
        expect(user).toHaveProperty(
          'last_name',
          MOCK_DATA.COMMON_SETTINGS.last_name
        )
        expect(user).toHaveProperty(
          'first_name',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty(
          'language',
          MOCK_DATA.COMMON_SETTINGS.language
        )
        expect(user).toHaveProperty(
          'timezone',
          MOCK_DATA.COMMON_SETTINGS.timezone
        )
      })
    })

    describe('Profile Visibility: Contacts - Viewer NOT in target contacts', () => {
      beforeEach(() => {
        // Mock that viewer is NOT in target's contacts
        addressBookServiceMock.list.mockImplementation(
          async (userId: string) => {
            if (userId === MATRIX_MXID) {
              return {
                contacts: [
                  {
                    mxid: '@someone_else:docker.localhost',
                    display_name: 'Other User'
                  }
                ]
              }
            }
            return { contacts: [] }
          }
        )
      })

      it('Should hide Common Settings email/phone when viewer is not in contacts', async () => {
        mockMatrix({ displayName: true, avatar: true })
        mockTwakeDB(
          {
            displayName: true,
            lastName: true,
            firstName: true,
            mail: true,
            phone: true,
            language: true,
            timezone: true
          },
          {
            matrix_id: MATRIX_MXID,
            visibility: ProfileVisibility.Contacts,
            visible_fields: [ProfileField.Email, ProfileField.Phone]
          }
        )

        const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.COMMON_SETTINGS.display_name
        )
        expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
        expect(user).toHaveProperty(
          'givenName',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).not.toHaveProperty('emails')
        expect(user).not.toHaveProperty('phones')
        expect(user).toHaveProperty(
          'last_name',
          MOCK_DATA.COMMON_SETTINGS.last_name
        )
        expect(user).toHaveProperty(
          'first_name',
          MOCK_DATA.COMMON_SETTINGS.first_name
        )
        expect(user).toHaveProperty(
          'language',
          MOCK_DATA.COMMON_SETTINGS.language
        )
        expect(user).toHaveProperty(
          'timezone',
          MOCK_DATA.COMMON_SETTINGS.timezone
        )
      })
    })
  })

  describe('Data source precedence with Common Settings enabled', () => {
    it('Should show Matrix display_name over Common Settings display_name', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockTwakeDB({ displayName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
    })

    it('Should use Common Settings display_name when Matrix missing displayname', async () => {
      mockMatrix({ avatar: true })
      mockTwakeDB({ displayName: true, lastName: true, firstName: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
    })
  })
})

describe('User Info Service GET with: Additional features ON, Common settings ON', () => {
  const svc = createService(true, true)

  describe('When no viewer is provided', () => {
    afterEach(() => {
      // When no viewer ToM cannot lookup the address book
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return null when no records found at all', async () => {
      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return user data when only UserDB has a record', async () => {
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.LDAP.cn)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
    })

    it('Should return user data when only Common Settings has a record', async () => {
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        mail: true,
        phone: true,
        language: true,
        timezone: true
      })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })

    it('Should merge data from Matrix, UserDB, and Common Settings', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ lastName: true, givenName: true, mail: true })
      mockTwakeDB({ phone: true, language: true, timezone: true })

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })
  })

  describe('When viewer is provided', () => {
    const viewer = '@viewer:docker.localhost'

    it('Should return null when no records found at all', async () => {
      const user = await svc.get(MATRIX_MXID, viewer)

      expect(user).toBeNull()
    })

    it('Should include addressbook data when available', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ lastName: true, givenName: true, mail: true })
      mockTwakeDB({ phone: true, language: true, timezone: true })
      mockAddressBook({ displayName: true })

      const user = await svc.get(MATRIX_MXID, viewer)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.ADDRESSBOOK.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })

    it('Should prioritize data sources correctly: AddressBook > Matrix > Common Settings > UserDB', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({
        displayName: true,
        lastName: true,
        firstName: true,
        mail: true,
        phone: true,
        language: true,
        timezone: true
      })
      mockAddressBook({ displayName: true })

      const user = await svc.get(MATRIX_MXID, viewer)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.ADDRESSBOOK.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)

      expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )

      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')

      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })

    it('Should fall back to lower priority sources when higher priority missing data', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ lastName: true, givenName: true, mail: true })
      mockTwakeDB({ phone: true, language: true, timezone: true })
      mockAddressBook()

      const user = await svc.get(MATRIX_MXID, viewer)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })
  })

  describe('Data source precedence with both feature flags enabled', () => {
    it('Should prioritize AddressBook display_name over all other sources', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true })
      mockTwakeDB({ displayName: true })
      mockAddressBook({ displayName: true })

      const user = await svc.get(MATRIX_MXID, '@viewer:docker.localhost')

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.ADDRESSBOOK.display_name
      )
    })

    it('Should use Common Settings display_name when AddressBook missing but others present', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true })
      mockTwakeDB({ displayName: true })
      mockAddressBook()

      const user = await svc.get(MATRIX_MXID, '@viewer:docker.localhost')

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
    })

    it('Should use Common Settings display_name when Matrix and AddressBook missing', async () => {
      mockMatrix({ avatar: true })
      mockUserDB({ displayName: true })
      mockTwakeDB({ displayName: true })
      mockAddressBook()

      const user = await svc.get(MATRIX_MXID, '@viewer:docker.localhost')

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.COMMON_SETTINGS.display_name
      )
    })

    it('Should use UserDB display_name as last resort', async () => {
      mockMatrix({ avatar: true })
      mockUserDB({ displayName: true })
      mockTwakeDB()
      mockAddressBook()

      const user = await svc.get(MATRIX_MXID, '@viewer:docker.localhost')

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.LDAP.cn)
    })

    it('Should merge Common Settings email and UserDB email', async () => {
      mockMatrix({ displayName: true })
      mockUserDB({ mail: true })
      mockTwakeDB(
        { mail: true },
        {
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Email],
          matrix_id: MATRIX_MXID
        }
      )

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('emails', [
        MOCK_DATA.LDAP.mail,
        MOCK_DATA.COMMON_SETTINGS.email
      ])
    })

    it('Should merge Common Settings phone and UserDB phone', async () => {
      mockMatrix({ displayName: true })
      mockUserDB({ phone: true })
      mockTwakeDB(
        { phone: true },
        {
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Phone],
          matrix_id: MATRIX_MXID
        }
      )

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('phones', [
        MOCK_DATA.LDAP.mobile,
        MOCK_DATA.COMMON_SETTINGS.phone
      ])
    })

    it('Should include all available data from all sources when no conflicts', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ lastName: true, givenName: true, mail: true, phone: true })
      mockTwakeDB(
        { language: true, timezone: true },
        {
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Phone, ProfileField.Email],
          matrix_id: MATRIX_MXID
        }
      )

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })
  })

  describe('Edge cases with both feature flags enabled', () => {
    it('Should handle empty arrays from data sources gracefully', async () => {
      mockMatrix({ displayName: true })
      mockUserDB()
      mockTwakeDB()

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should return complete user profile when all sources have full data', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB(
        {
          displayName: true,
          lastName: true,
          firstName: true,
          mail: true,
          phone: true,
          language: true,
          timezone: true
        },
        {
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Phone, ProfileField.Email],
          matrix_id: MATRIX_MXID
        }
      )
      mockAddressBook({ displayName: true })

      const user = await svc.get(MATRIX_MXID, '@viewer:docker.localhost')

      expect(user).not.toBeNull()
      expect(user).toHaveProperty(
        'display_name',
        MOCK_DATA.ADDRESSBOOK.display_name
      )
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.COMMON_SETTINGS.last_name)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty(
        'last_name',
        MOCK_DATA.COMMON_SETTINGS.last_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty('emails', [
        MOCK_DATA.LDAP.mail,
        MOCK_DATA.COMMON_SETTINGS.email
      ])
      expect(user).toHaveProperty('phones', [
        MOCK_DATA.LDAP.mobile,
        MOCK_DATA.COMMON_SETTINGS.phone
      ])
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).toHaveProperty(
        'timezone',
        MOCK_DATA.COMMON_SETTINGS.timezone
      )
    })

    it('Should handle partial data from each source correctly', async () => {
      mockMatrix({ avatar: true })
      mockUserDB({ lastName: true, mail: true })
      mockTwakeDB(
        { firstName: true, phone: true, language: true },
        {
          matrix_id: MATRIX_MXID,
          visible_fields: [ProfileField.Email, ProfileField.Phone],
          visibility: ProfileVisibility.Public
        }
      )

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).not.toHaveProperty('display_name')
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty(
        'givenName',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty(
        'first_name',
        MOCK_DATA.COMMON_SETTINGS.first_name
      )
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      expect(user).toHaveProperty('phones', [MOCK_DATA.COMMON_SETTINGS.phone])
      expect(user).toHaveProperty(
        'language',
        MOCK_DATA.COMMON_SETTINGS.language
      )
      expect(user).not.toHaveProperty('timezone')
    })
  })
})

describe('User Info Service - Get Visibility Settings:', () => {
  const svc = createService(false, false)

  describe('Should return null user id is malformed:', () => {
    it('With null userId', async () => {
      const visibility = await svc.getVisibility(null as unknown as string)
      expect(visibility).toBeNull()
    })
    it('With empty userId', async () => {
      const visibility = await svc.getVisibility('')
      expect(visibility).toBeNull()
    })
    it('With localpart only userId', async () => {
      const visibility = await svc.getVisibility('@dwho')
      expect(visibility).toBeNull()
    })
    it('With serverpart only userId', async () => {
      const visibility = await svc.getVisibility(':domain.example')
      expect(visibility).toBeNull()
    })
    it('With no @ in userId', async () => {
      const visibility = await svc.getVisibility('dwho:domain.example')
      expect(visibility).toBeNull()
    })
  })

  describe('Should return a consistently formed visibility object:', () => {
    it('When no settings are found for the user', async () => {
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'private')
      expect(visibility).toHaveProperty('visible_fields', [])
    })
    it('When settings are found for the user - Private', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: []
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'private')
      expect(visibility).toHaveProperty('visible_fields', [])
    })
    it('When settings are found for the user - Private w/ email', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: [ProfileField.Email]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'private')
      expect(visibility).toHaveProperty('visible_fields', ['email'])
    })
    it('When settings are found for the user - Private w/ phone', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: [ProfileField.Phone]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'private')
      expect(visibility).toHaveProperty('visible_fields', ['phone'])
    })
    it('When settings are found for the user - Private w/ email & phone', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: [ProfileField.Email, ProfileField.Phone]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'private')
      expect(visibility).toHaveProperty('visible_fields', ['email', 'phone'])
    })
    it('When settings are found for the user - Public', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Public,
          visible_fields: []
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'public')
      expect(visibility).toHaveProperty('visible_fields', [])
    })
    it('When settings are found for the user - Public w/ email', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Email]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'public')
      expect(visibility).toHaveProperty('visible_fields', ['email'])
    })
    it('When settings are found for the user - Public w/ phone', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Phone]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'public')
      expect(visibility).toHaveProperty('visible_fields', ['phone'])
    })
    it('When settings are found for the user - Public w/ email & phone', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Email, ProfileField.Phone]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'public')
      expect(visibility).toHaveProperty('visible_fields', ['email', 'phone'])
    })
    it('When settings are found for the user - Contacts', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Contacts,
          visible_fields: []
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'contacts')
      expect(visibility).toHaveProperty('visible_fields', [])
    })
    it('When settings are found for the user - Contacts w/ email', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Contacts,
          visible_fields: [ProfileField.Email]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'contacts')
      expect(visibility).toHaveProperty('visible_fields', ['email'])
    })
    it('When settings are found for the user - Contacts w/ phone', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Contacts,
          visible_fields: [ProfileField.Phone]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'contacts')
      expect(visibility).toHaveProperty('visible_fields', ['phone'])
    })
    it('When settings are found for the user - Contacts w/ email & phone', async () => {
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Contacts,
          visible_fields: [ProfileField.Email, ProfileField.Phone]
        }
      )
      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).toHaveProperty('visibility', 'contacts')
      expect(visibility).toHaveProperty('visible_fields', ['email', 'phone'])
    })
  })
})

describe('User Info Service - Default Visibility Settings Configuration:', () => {
  describe('When default_visibility_settings config is set to Private with no fields', () => {
    const svc = createService(false, false)

    it('Should apply default visibility when user has no explicit profile settings', async () => {
      mockTwakeDB({}, null) // No explicit profile settings

      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).not.toBeNull()
      expect(visibility).toHaveProperty('visibility', 'private')
      expect(visibility).toHaveProperty('visible_fields', [])
    })

    it('Should apply default visibility for GET request when no viewer and no explicit settings', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({}, null) // No explicit profile settings

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      // Email and phone should be hidden due to default private visibility with no visible fields
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
    })

    it('Should apply default visibility for GET request when viewer is different user and no explicit settings', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({}, null) // No explicit profile settings

      const user = await svc.get(MATRIX_MXID, '@viewer:example.org')

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      // Email and phone should be hidden due to default private visibility
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
    })

    it('Should show all fields when viewer is target (viewing own profile) regardless of default settings', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({}, null) // No explicit profile settings

      const user = await svc.get(MATRIX_MXID, MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      // When viewing own profile, all fields should be visible
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
    })

    it('Should override default visibility when user has explicit profile settings', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      // User has explicit public visibility with email field visible
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Public,
          visible_fields: [ProfileField.Email]
        }
      )

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      // Email should be visible due to explicit public visibility
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      // Phone should not be visible (not in visible_fields)
      expect(user).not.toHaveProperty('phones')
    })
  })

  describe('When default_visibility_settings config is set to Public with email visible', () => {
    const createServiceWithPublicDefault = () => {
      const cfg = {
        ...BASE_CONFIG,
        additional_features: false,
        features: {
          ...BASE_CONFIG.features,
          common_settings: { enabled: false },
          user_profile: {
            default_visibility_settings: {
              visibility: 'public',
              visible_fields: ['email']
            }
          }
        }
      } as unknown as Config

      const svc = new UserInfoService(
        userDBMock as unknown as UserDB,
        twakeDBMock as unknown as TwakeDB,
        matrixDBMock as unknown as MatrixDB,
        cfg,
        loggerMock as unknown as TwakeLogger
      )

      ;(svc as any).addressBookService =
        addressBookServiceMock as unknown as IAddressbookService

      return svc
    }

    it('Should apply public default visibility with email when user has no explicit settings', async () => {
      const svc = createServiceWithPublicDefault()
      mockTwakeDB({}, null) // No explicit profile settings

      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).not.toBeNull()
      expect(visibility).toHaveProperty('visibility', 'public')
      expect(visibility).toHaveProperty('visible_fields', ['email'])
    })

    it('Should show email field for GET request when no viewer and public default settings', async () => {
      const svc = createServiceWithPublicDefault()
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({}, null) // No explicit profile settings

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      // Email should be visible due to default public visibility with email field
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      // Phone should not be visible (not in default visible_fields)
      expect(user).not.toHaveProperty('phones')
    })

    it('Should override default public visibility when user sets explicit private settings', async () => {
      const svc = createServiceWithPublicDefault()
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      // User explicitly sets private visibility
      mockTwakeDB(
        {},
        {
          matrix_id: MATRIX_MXID,
          visibility: ProfileVisibility.Private,
          visible_fields: []
        }
      )

      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      // Email and phone should be hidden due to explicit private visibility
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
    })
  })

  describe('When default_visibility_settings config is set to Contacts with both fields visible', () => {
    const createServiceWithContactsDefault = () => {
      const cfg = {
        ...BASE_CONFIG,
        additional_features: false,
        features: {
          ...BASE_CONFIG.features,
          common_settings: { enabled: false },
          user_profile: {
            default_visibility_settings: {
              visibility: 'contacts',
              visible_fields: ['email', 'phone']
            }
          }
        }
      } as unknown as Config

      const svc = new UserInfoService(
        userDBMock as unknown as UserDB,
        twakeDBMock as unknown as TwakeDB,
        matrixDBMock as unknown as MatrixDB,
        cfg,
        loggerMock as unknown as TwakeLogger
      )

      ;(svc as any).addressBookService =
        addressBookServiceMock as unknown as IAddressbookService

      return svc
    }

    it('Should apply contacts default visibility with both fields when user has no explicit settings', async () => {
      const svc = createServiceWithContactsDefault()
      mockTwakeDB({}, null) // No explicit profile settings

      const visibility = await svc.getVisibility(MATRIX_MXID)

      expect(visibility).not.toBeNull()
      expect(visibility).toHaveProperty('visibility', 'contacts')
      expect(visibility).toHaveProperty('visible_fields', ['email', 'phone'])
    })

    it('Should hide contact fields when viewer is not in contacts (default contacts visibility)', async () => {
      const svc = createServiceWithContactsDefault()
      const VIEWER_MXID = '@viewer:example.org'

      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({}, null) // No explicit profile settings

      // Mock addressbook - viewer is NOT in target's contacts
      addressBookServiceMock.list.mockResolvedValue({
        contacts: [
          {
            mxid: '@someone-else:example.org',
            display_name: 'Someone Else'
          }
        ]
      })

      const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      // Email and phone should be hidden because viewer is not in contacts
      expect(user).not.toHaveProperty('emails')
      expect(user).not.toHaveProperty('phones')
    })

    it('Should show contact fields when viewer is in contacts (default contacts visibility)', async () => {
      const svc = createServiceWithContactsDefault()
      const VIEWER_MXID = '@viewer:example.org'

      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({
        displayName: true,
        lastName: true,
        givenName: true,
        mail: true,
        phone: true
      })
      mockTwakeDB({}, null) // No explicit profile settings

      // Mock addressbook - viewer IS in target's contacts
      addressBookServiceMock.list.mockResolvedValue({
        contacts: [
          {
            mxid: VIEWER_MXID,
            display_name: 'Viewer Name'
          }
        ]
      })

      const user = await svc.get(MATRIX_MXID, VIEWER_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar_url', MOCK_DATA.MATRIX.avatar_url)
      // Email and phone should be visible because viewer is in contacts
      expect(user).toHaveProperty('emails', [MOCK_DATA.LDAP.mail])
      expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
    })
  })
})
