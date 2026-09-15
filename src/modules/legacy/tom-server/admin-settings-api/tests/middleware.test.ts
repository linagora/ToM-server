import { afterEach, beforeEach, describe, expect, it, mock, type Mock } from 'bun:test'
import AdminSettingsMiddleware from '../middlewares'
import conf from '../../../defaultConfig.json'

interface MockLogger {
  info: Mock<(...args: any[]) => any>
  warn: Mock<(...args: any[]) => any>
  error: Mock<(...args: any[]) => any>
}

const makeLogger = (): MockLogger => ({
  info: mock(),
  warn: mock(),
  error: mock()
})

describe('AdminSettingsMiddleware', () => {
  let middleware: AdminSettingsMiddleware
  let logger: MockLogger
  let req: any
  let res: any
  let next: Mock<(...args: any[]) => any>

  beforeEach(() => {
    logger = makeLogger()
    middleware = new AdminSettingsMiddleware(conf as any, logger as any)

    req = {
      headers: {}
    }
    res = {
      status: mock().mockReturnThis(),
      json: mock()
    }
    next = mock()
  })

  afterEach(() => {
    mock.restore()
  })

  describe('checkAdminSettingsToken', () => {
    it('should return 401 if Authorization header is missing', () => {
      middleware.checkAdminSettingsToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 401 if Authorization header is invalid', () => {
      req.headers.authorization = 'InvalidHeader token'
      middleware.checkAdminSettingsToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 if token does not match', () => {
      req.headers.authorization = 'Bearer wrong-token'
      middleware.checkAdminSettingsToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden: invalid token'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should call next if token matches', () => {
      req.headers.authorization = `Bearer ${conf.admin_access_token}`

      middleware.checkAdminSettingsToken(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })
  })
})
