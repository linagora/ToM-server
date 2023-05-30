import MASRouter, { EHttpMethod } from '.'
import MatrixApplicationServer from '..'

describe('MASRouter', () => {
  const appServer = new MatrixApplicationServer()
  const router = new MASRouter(appServer)

  it('should return basic application server routes on create an instance', () => {
    const expectedRoutes: Record<string, object> = {
      '/_matrix/app/v1/transactions/:txnId': { put: true, _all: true },
      '/_matrix/app/v1/users/:userId': { get: true, _all: true },
      '/_matrix/app/v1/rooms/:roomAlias': { get: true, _all: true },
      '/^/users|rooms|transactions/:[a-zA-Z0-9]/g': { _all: true }
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
      '/^\\/users|rooms|transactions\\/:[a-zA-Z0-9]/g'
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
