import MatrixApplicationServer, { type Config } from '.'
import defaultConfig from './config.json'
import fs from 'fs'
import path from 'path'
import testConfig from './__testData__/config.json'

const registrationFilePath = path.join(__dirname, '..', 'registration.yaml')

describe('MatrixApplicationServer', () => {
  describe('getConfigurationFile', () => {
    let appServer: MatrixApplicationServer

    afterEach(() => {
      jest.restoreAllMocks()
      if (fs.existsSync(registrationFilePath)) {
        fs.unlinkSync(registrationFilePath)
      }
    })

    it('should return config from file linked to process.env.TWAKE_AS_SERVER_CONF', async () => {
      process.env.TWAKE_AS_SERVER_CONF = path.join(
        __dirname,
        '__testData__',
        'config.json'
      )
      appServer = new MatrixApplicationServer()
      expect(appServer.conf).toStrictEqual(testConfig)
    })

    it('should return default config', async () => {
      delete process.env.TWAKE_AS_SERVER_CONF
      appServer = new MatrixApplicationServer()
      expect(appServer.conf).toStrictEqual(defaultConfig)
    })

    it('should return config from etc folder', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
      const spyOnConfigParser = jest
        .spyOn(jest.requireActual('@twake/config-parser'), 'default')
        .mockImplementation(() => defaultConfig)
      appServer = new MatrixApplicationServer()
      expect(spyOnConfigParser).toHaveBeenCalledWith(
        defaultConfig,
        '/etc/twake/as-server.conf'
      )
    })

    it('should return config from parameter', async () => {
      const config: Config = {
        application_server_url: 'http://localhost:8080',
        sender_localpart: 'matrix',
        registration_file_path: 'registration.yaml',
        namespaces: { users: [] }
      }
      appServer = new MatrixApplicationServer(config)
      expect(appServer.conf).toStrictEqual(config)
    })
  })

})
