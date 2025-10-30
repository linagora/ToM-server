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
  features: { common_settings: { enabled: false } } as any
}

const MATRIX_MXID = '@dwho:docker.localhost'

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
    const forgeProfile = () => {
      if (Object.values(useProfileDefaults).every((v) => !v)) {
        return null
      } else {
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
            value: MOCK_DATA.COMMON_SETTINGS.display_name,
            writable: false
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
          Object.defineProperty(profile, 'mail', {
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

        return profile
      }
    }

    twakeDBMock.get.mockClear()
    const userProfile = forgeProfile()

    twakeDBMock.get.mockImplementation(
      async (table, fields, filterFields, order?): Promise<DbGetResult> => {
        let r
        switch (table) {
          case 'usersettings':
            r = userProfile
            break
          case 'profileSettings':
            r = useProfileSettings || null
            break
          default:
            r = null
        }
        return r ? [r] : ([] as unknown as DbGetResult)
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
      const { displayName } = useProfileDefaults
      const profile = {}

      if (displayName)
        Object.defineProperty(profile, 'display_name', {
          value: MOCK_DATA.ADDRESSBOOK.display_name,
          writable: false
        })

      addressBookServiceMock.list.mockResolvedValue({
        contacts: [{ ...profile }]
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
    features: { common_settings: { enabled: commonSettingsEnabled } }
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

describe('User Info Service with: No feature flags ON', () => {
  describe('When no viewer is provided', () => {
    afterEach(() => {
      // When no viewer ToM cannot lookup the address book
      expect(addressBookServiceMock.list).not.toHaveBeenCalled()
    })

    it('Should return null when no records found at all', async () => {
      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return null even if UserDB has a record', async () => {
      mockUserDB({ displayName: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).toBeNull()
    })

    it('Should return only display name if only MatrixDB has a record', async () => {
      mockMatrix({ displayName: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('mails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should return display name and avatar only if only MatrixDB has a record and is full', async () => {
      mockMatrix({ displayName: true, avatar: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('mails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if UserDB has a record too - 1', async () => {
      mockMatrix({ displayName: true })
      mockUserDB({ displayName: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).not.toHaveProperty('avatar')
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('mails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should NOT overwrite MatrixDB fields if UserDB has a record too - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
      expect(user).not.toHaveProperty('sn')
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('mails')
      expect(user).not.toHaveProperty('phones')
      expect(user).not.toHaveProperty('last_name')
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should add UserDB fields but display name - 1', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true, lastName: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).not.toHaveProperty('givenName')
      expect(user).not.toHaveProperty('mails')
      expect(user).not.toHaveProperty('phones')
      expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
      expect(user).not.toHaveProperty('first_name')
      expect(user).not.toHaveProperty('language')
      expect(user).not.toHaveProperty('timezone')
    })

    it('Should add UserDB fields but display name - 2', async () => {
      mockMatrix({ displayName: true, avatar: true })
      mockUserDB({ displayName: true, lastName: true, givenName: true })

      const svc = createService(false, false)
      const user = await svc.get(MATRIX_MXID)

      expect(user).not.toBeNull()
      expect(user).toHaveProperty('display_name', MOCK_DATA.MATRIX.displayname)
      expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
      expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
      expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
      expect(user).not.toHaveProperty('mails')
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

        const svc = createService(false, false)
        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('mails')
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

        const svc = createService(false, false)
        const user = await svc.get(MATRIX_MXID)

        expect(user).not.toBeNull()
        expect(user).toHaveProperty(
          'display_name',
          MOCK_DATA.MATRIX.displayname
        )
        expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
        expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
        expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
        expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('mails', [MOCK_DATA.LDAP.mail])
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('mails', [MOCK_DATA.LDAP.mail])
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('mails')
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('mails', [MOCK_DATA.LDAP.mail])
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

          const svc = createService(false, false)
          const user = await svc.get(MATRIX_MXID)

          expect(user).not.toBeNull()
          expect(user).toHaveProperty(
            'display_name',
            MOCK_DATA.MATRIX.displayname
          )
          expect(user).toHaveProperty('avatar', MOCK_DATA.MATRIX.avatar_url)
          expect(user).toHaveProperty('sn', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('givenName', MOCK_DATA.LDAP.givenName)
          expect(user).toHaveProperty('mails', [MOCK_DATA.LDAP.mail])
          expect(user).toHaveProperty('phones', [MOCK_DATA.LDAP.mobile])
          expect(user).toHaveProperty('last_name', MOCK_DATA.LDAP.sn)
          expect(user).toHaveProperty('first_name', MOCK_DATA.LDAP.givenName)
          expect(user).not.toHaveProperty('language')
          expect(user).not.toHaveProperty('timezone')
        })
      })
    })
  })
})
