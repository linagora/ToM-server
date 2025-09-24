import AdminSettingsrController from '../controllers'
import conf from '../../config.json'

interface MockLogger {
  info: jest.Mock
  warn: jest.Mock
  error: jest.Mock
}

const makeLogger = (): MockLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
})

describe('AdminSettingsrController', () => {
  let controller: AdminSettingsrController
  let logger: MockLogger
  let req: any
  let res: any
  let next: jest.Mock
  let updateUserSpy: jest.SpyInstance

  beforeEach(() => {
    logger = makeLogger()
    controller = new AdminSettingsrController(conf as any, logger as any)

    req = {
      params: { id: 'user1' },
      body: { displayName: 'Alice', avatarUrl: 'http://example.com/avatar.png' }
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    next = jest.fn()

    // Mock updateUserInformation to avoid real HTTP calls
    updateUserSpy = jest
      .spyOn((controller as any).adminService, 'updateUserInformation')
      .mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return 400 if userId or displayName is missing', async () => {
    req.params.id = ''
    req.body.displayName = ''

    await controller.handle(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Missing user ID or display name'
    })
    expect(updateUserSpy).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('should call updateUserInformation and return 200 on success', async () => {
    await controller.handle(req, res, next)

    expect(updateUserSpy).toHaveBeenCalledWith('user1', {
      displayName: 'Alice',
      avatarUrl: 'http://example.com/avatar.png'
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({})
    expect(next).not.toHaveBeenCalled()
  })

  it('should call next with error if updateUserInformation throws', async () => {
    const error = new Error('Failed')
    updateUserSpy.mockRejectedValueOnce(error)

    await controller.handle(req, res, next)

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to handle request'),
      { error }
    )
    expect(next).toHaveBeenCalledWith(error)
  })
})
