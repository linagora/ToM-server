import { ETransportType, getLogger, type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import path from 'path'
import MASRouter, { EHttpMethod } from '.'
import MatrixApplicationServer from '..'
import { JEST_PROCESS_ROOT_PATH, removeLogFile } from '../../jest.globals'

const registrationFilePath = path.join(
  JEST_PROCESS_ROOT_PATH,
  'registration.yaml'
)

const logsDir = path.join(JEST_PROCESS_ROOT_PATH, 'logs')
const logsFilename = 'app-server-routes-test.log'

describe('MASRouter', () => {
  let appServer: MatrixApplicationServer
  let router: MASRouter
  let logger: TwakeLogger

  beforeAll(() => {
    logger = getLogger({
      logging: {
        log_transports: [
          {
            type: ETransportType.FILE,
            options: {
              dirname: logsDir,
              filename: logsFilename
            }
          }
        ]
      }
    })
    appServer = new MatrixApplicationServer(undefined, undefined, logger)
    router = new MASRouter(appServer)
    if (fs.existsSync(registrationFilePath)) {
      fs.unlinkSync(registrationFilePath)
    }
  })

  afterAll((done) => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    logger.on('finish', async () => {
      await removeLogFile(path.join(logsDir, logsFilename))
      done()
    })
    logger.end()
  })

  it('should return basic application server routes on create an instance', () => {
    const expectedRoutes: Record<string, object> = {
      '/_matrix/app/v1/transactions/:txnId': { put: true, _all: true },
      '/_matrix/app/v1/users/:userId': { get: true, _all: true },
      '/_matrix/app/v1/rooms/:roomAlias': { get: true, _all: true },
      '/^/(users|rooms|transactions)/[a-zA-Z0-9]*/g': { _all: true }
    }
    const expectedPaths = Object.keys(expectedRoutes)
    expect(router.routes).toBeDefined()
    expect(router.routes).not.toBeNull()
    const stack = router.routes.stack
    expect(stack).toHaveLength(4)
    for (let i = 0; i < 3; i++) {
      expect(stack[i].route.path).toEqual(expectedPaths[i])
      expect(stack[i].route.methods).toStrictEqual(
        expectedRoutes[expectedPaths[i]]
      )
    }
    expect(stack[3].route.path.toString()).toEqual(
      '/^\\/(users|rooms|transactions)\\/[a-zA-Z0-9]*/g'
    )
    expect(stack[3].route.methods).toStrictEqual({ _all: true })
  })

  it('should add route', () => {
    expect(router.routes.stack).toHaveLength(4)
    const newRoutes: Record<string, { path: string; methods: object }> = {
      [EHttpMethod.DELETE]: {
        path: '/test/route/delete',
        methods: { delete: true, _all: true }
      },
      [EHttpMethod.GET]: {
        path: '/test/route/get',
        methods: { get: true, _all: true }
      },
      [EHttpMethod.POST]: {
        path: '/test/route/post',
        methods: { post: true, _all: true }
      },
      [EHttpMethod.PUT]: {
        path: '/test/route/put',
        methods: { put: true, _all: true }
      },
      falsy_method: { path: 'falsy', methods: { _all: true } }
    }
    const keys = Object.keys(newRoutes)
    keys.forEach((method) => {
      router.addRoute(
        newRoutes[method].path,
        method as EHttpMethod,
        (req, res, next) => {},
        []
      )
    })
    const stack = router.routes.stack
    expect(stack).toHaveLength(9)
    for (let i = 4; i < 9; i++) {
      expect(stack[i].route.path).toEqual(newRoutes[keys[i - 4]].path)
      expect(stack[i].route.methods).toStrictEqual(
        newRoutes[keys[i - 4]].methods
      )
    }
  })
})
