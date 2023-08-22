import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import { type Config } from '..'
import defaultConfig from '../config.json'
import { AppServiceRegistration, type AppServiceOutput } from './registration'

const testDataFolderPath = path.join(__dirname, '..', '__testData__')
const yamlFalsyTestFilePath = path.join(
  testDataFolderPath,
  'falsy_registration.yaml'
)
const yamlTestFilePath = path.join(testDataFolderPath, 'registration.yaml')

const testConfig = {
  ...defaultConfig,
  namespaces: {
    users: [
      {
        exclusive: false,
        regex: '@_irc_bridge_.*'
      },
      {
        exclusive: true,
        regex: '@_twake_.*'
      },
      {
        exclusive: false,
        regex: '@_test_.*'
      }
    ]
  }
}

describe('Registration', () => {
  describe('Class constructor (with setter and getter)', () => {
    let spyOnLoad: jest.SpyInstance

    beforeEach(() => {
      spyOnLoad = jest.spyOn(yaml, 'load')
    })

    it('should create a class instance based on config', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      expect(spyOnLoad).not.toHaveBeenCalled()
      expect(appServiceRegistration.asToken).not.toBeNull()
      expect(appServiceRegistration.asToken).not.toBeUndefined()
      expect(appServiceRegistration.hsToken).not.toBeNull()
      expect(appServiceRegistration.hsToken).not.toBeUndefined()
      expect(appServiceRegistration.id).not.toBeNull()
      expect(appServiceRegistration.id).not.toBeUndefined()
      expect(appServiceRegistration.senderLocalpart).toEqual(
        testConfig.sender_localpart
      )
      expect(appServiceRegistration.url).toEqual(testConfig.base_url)
      expect(appServiceRegistration.namespaces).toStrictEqual(
        testConfig.namespaces
      )
      expect(appServiceRegistration.pushEphemeral).toEqual(
        testConfig.push_ephemeral
      )
    })

    it('should create a class instance based on config with some default values', () => {
      const appServiceRegistration = new AppServiceRegistration({
        ...testConfig,
        namespaces: undefined,
        push_ephemeral: undefined
      })
      expect(spyOnLoad).not.toHaveBeenCalled()
      expect(appServiceRegistration.asToken).not.toBeNull()
      expect(appServiceRegistration.asToken).not.toBeUndefined()
      expect(appServiceRegistration.hsToken).not.toBeNull()
      expect(appServiceRegistration.hsToken).not.toBeUndefined()
      expect(appServiceRegistration.id).not.toBeNull()
      expect(appServiceRegistration.id).not.toBeUndefined()
      expect(appServiceRegistration.senderLocalpart).toEqual(
        testConfig.sender_localpart
      )
      expect(appServiceRegistration.url).toEqual(testConfig.base_url)
      expect(appServiceRegistration.namespaces).toStrictEqual({})
      expect(appServiceRegistration.pushEphemeral).toEqual(false)
    })

    it('should create a class instance based on registration.yaml file', () => {
      const config: Config = {
        ...testConfig,
        registration_file_path: yamlTestFilePath
      }
      const appServiceRegistration = new AppServiceRegistration(config)
      expect(spyOnLoad).toHaveBeenCalledTimes(1)
      expect(appServiceRegistration.asToken).toEqual('as_token_test')
      expect(appServiceRegistration.hsToken).toEqual(
        'hsTokenTestwdakZQunWWNe3DZitAerw9aNqJ2a6HVp0sJtg7qTJWXcHnBjgN0NL'
      )
      expect(appServiceRegistration.id).toEqual('test')
      expect(appServiceRegistration.senderLocalpart).toEqual(
        'sender_localpart_test'
      )
      expect(appServiceRegistration.url).toEqual('http://localhost:3000')
      expect(appServiceRegistration.namespaces).toStrictEqual({
        users: [
          {
            exclusive: false,
            regex: '@_irc_bridge_.*'
          }
        ]
      })
      expect(appServiceRegistration.pushEphemeral).toEqual(true)
    })

    it('should throw YAMLException if there is an error in yaml file', () => {
      const config: Config = {
        ...testConfig,
        registration_file_path: yamlFalsyTestFilePath
      }
      let appServiceRegistration: AppServiceRegistration | undefined
      try {
        appServiceRegistration = new AppServiceRegistration(config)
      } catch (e) {
        expect(spyOnLoad).toHaveBeenCalledTimes(1)
        expect(e).toBeInstanceOf(yaml.YAMLException)
        expect(appServiceRegistration).toBeUndefined()
      }
    })

    it('should throw error if url is not a string', () => {
      const config: any = {
        ...testConfig,
        base_url: false
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error('The value of "url" field in configuration must be a string')
      )
    })

    it('should throw error if url does not match regex', () => {
      const config: Config = {
        ...testConfig,
        base_url: 'falsy_url'
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error(
          'The value of "url" field in configuration is not a correct url'
        )
      )
    })

    it('should throw error if sender_localpart is not a string', () => {
      const config: any = {
        ...testConfig,
        sender_localpart: false
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error(
          'The value of "sender_localpart" field in configuration must be a string'
        )
      )
    })

    it('should throw error if push_ephemeral is not a boolean', () => {
      const config: any = {
        ...testConfig,
        push_ephemeral: 'falsy'
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error(
          'The value of "push_ephemeral" field in configuration must be a boolean'
        )
      )
    })

    it('should throw error if namespaces is not an object', () => {
      const config: any = {
        ...testConfig,
        namespaces: false
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error(
          'The value of "namespaces" field in configuration must be an object'
        )
      )
    })

    it('should throw error if namespaces contains a field which is not "users", "rooms" or "aliases"', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          falsyField: null
        }
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error(
          'The field "falsyField" does not belong to the authorized fields: users, rooms, aliases'
        )
      )
    })

    it('should throw error if namespaces contains a field whose value is not an array', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          users: false
        }
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error('The value of field "users" should be an array')
      )
    })

    it('should throw error if a namespace has no regex field', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          users: [
            {
              exclusive: false
            }
          ]
        }
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error('regex field is not defined for "users" field at index 0')
      )
    })

    it('should throw error if a namespace regex field is not a string', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          users: [
            {
              regex: false,
              exclusive: false
            }
          ]
        }
      }
      expect(() => new AppServiceRegistration(config)).toThrowError(
        new Error('regex field should be a string for "users" field at index 0')
      )
    })
  })

  describe('Class methods', () => {
    let spyOnDump: jest.SpyInstance
    let spyOnWriteFileSync: jest.SpyInstance

    beforeEach(() => {
      spyOnDump = jest.spyOn(yaml, 'dump')
      spyOnWriteFileSync = jest.spyOn(fs, 'writeFileSync')
    })

    it('createRegisterFile: should create registration.yaml file', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      appServiceRegistration.protocols = ['test']
      appServiceRegistration.rateLimited = false

      const expectedFileContent = {
        id: appServiceRegistration.id,
        hs_token: appServiceRegistration.hsToken,
        as_token: appServiceRegistration.asToken,
        url: appServiceRegistration.url,
        sender_localpart: appServiceRegistration.senderLocalpart,
        namespaces: appServiceRegistration.namespaces,
        rate_limited: false,
        protocols: ['test'],
        'de.sorunome.msc2409.push_ephemeral':
          appServiceRegistration.pushEphemeral
      }

      expect(fs.existsSync(testConfig.registration_file_path)).toEqual(false)

      appServiceRegistration.createRegisterFile(
        testConfig.registration_file_path
      )

      expect(spyOnDump).toHaveBeenCalledTimes(1)
      expect(spyOnDump).toHaveBeenCalledWith(expectedFileContent)
      expect(spyOnWriteFileSync).toHaveBeenCalledTimes(1)
      expect(fs.existsSync(testConfig.registration_file_path)).toEqual(true)
      fs.unlinkSync(testConfig.registration_file_path)
    })

    it('createRegisterFile: should keep yaml file if already exists', () => {
      const config: Config = {
        ...testConfig,
        registration_file_path: yamlTestFilePath
      }
      const appServiceRegistration = new AppServiceRegistration(config)
      appServiceRegistration.protocols = ['test']
      appServiceRegistration.rateLimited = false

      const spyOnInfo = jest.spyOn(console, 'info')

      expect(fs.existsSync(config.registration_file_path)).toEqual(true)

      appServiceRegistration.createRegisterFile(config.registration_file_path)

      const fileContent = yaml.load(
        fs.readFileSync(config.registration_file_path, { encoding: 'utf8' })
      ) as AppServiceOutput

      const expectedFileContent = {
        id: appServiceRegistration.id,
        hs_token: appServiceRegistration.hsToken,
        as_token: appServiceRegistration.asToken,
        url: appServiceRegistration.url,
        sender_localpart: appServiceRegistration.senderLocalpart,
        namespaces: appServiceRegistration.namespaces,
        'de.sorunome.msc2409.push_ephemeral':
          appServiceRegistration.pushEphemeral
      }

      expect(spyOnInfo).toHaveBeenCalledTimes(1)
      expect(spyOnInfo).toHaveBeenCalledWith(
        'Application service registration file already exists'
      )
      expect(fileContent).toStrictEqual(expectedFileContent)
      expect(fileContent.protocols).toBeUndefined()
      expect(fileContent.rate_limited).toBeUndefined()
      expect(spyOnDump).not.toHaveBeenCalled()
      expect(spyOnWriteFileSync).not.toHaveBeenCalled()
      expect(fs.existsSync(config.registration_file_path)).toEqual(true)
    })

    it('isRateLimited: should return true if rateLimited property is undefined', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      expect(appServiceRegistration.isRateLimited()).toEqual(true)
    })

    it('isRateLimited: should return rateLimited property value if defined', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      appServiceRegistration.rateLimited = false
      expect(appServiceRegistration.isRateLimited()).toEqual(false)
    })

    it('isUserMatch: should return false if no users namespace', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          rooms: [],
          aliases: []
        }
      }
      const appServiceRegistration = new AppServiceRegistration(config)
      expect(appServiceRegistration.isUserMatch('test', false)).toEqual(false)
    })

    it('isUserMatch: should return false if users namespace is an empty array', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          users: []
        }
      }
      const appServiceRegistration = new AppServiceRegistration(config)
      expect(appServiceRegistration.isUserMatch('test', false)).toEqual(false)
    })

    it('isUserMatch: should return false if sample does not match a regex', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      expect(appServiceRegistration.isUserMatch('falsyUserId', false)).toEqual(
        false
      )
    })

    it('isUserMatch: should return true if sample matches a regex', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      expect(
        appServiceRegistration.isUserMatch('@_irc_bridge_test', false)
      ).toEqual(true)
    })

    it('isUserMatch: should return true if sample matches a regex and restricting match to only exclusive regex', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      expect(appServiceRegistration.isUserMatch('@_twake_test', true)).toEqual(
        true
      )
    })

    it('isUserMatch: should return false if sample matches a not exclusive regex and restricting match to only exclusive regex', () => {
      const appServiceRegistration = new AppServiceRegistration(testConfig)
      expect(
        appServiceRegistration.isUserMatch('@_irc_bridge_test', true)
      ).toEqual(false)
    })

    it('isRoomMatch: should return true if sample matches a regex', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          rooms: [
            {
              exclusive: true,
              regex: '@_twake_.*'
            }
          ]
        }
      }

      const appServiceRegistration = new AppServiceRegistration(config)
      expect(appServiceRegistration.isRoomMatch('@_twake_test', false)).toEqual(
        true
      )
    })

    it('isAliasMatch: should return true if sample matches a regex', () => {
      const config: any = {
        ...testConfig,
        namespaces: {
          aliases: [
            {
              exclusive: true,
              regex: '@_twake_.*'
            }
          ]
        }
      }

      const appServiceRegistration = new AppServiceRegistration(config)
      expect(
        appServiceRegistration.isAliasMatch('@_twake_test', false)
      ).toEqual(true)
    })
  })
})
