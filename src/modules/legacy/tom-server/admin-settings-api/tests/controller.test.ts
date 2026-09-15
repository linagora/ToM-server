import { afterEach, beforeEach, describe, expect, it, mock, spyOn, type Mock } from 'bun:test'
import AdminSettingsrController from '../controllers'
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

describe('AdminSettingsrController', () => {
  let controller: AdminSettingsrController
  let logger: MockLogger
  let req: any
  let res: any
  let next: Mock<(...args: any[]) => any>
  let updateUserSpy: Mock<(...args: any[]) => any>

  beforeEach(() => {
    logger = makeLogger()
    controller = new AdminSettingsrController(conf as any, logger as any)

    req = {
      params: { id: 'user1' },
      body: { displayName: 'Alice', avatarUrl: 'http://example.com/avatar.png' }
    }
    res = {
      status: mock().mockReturnThis(),
      json: mock()
    }
    next = mock()

    // Mock updateUserInformation to avoid real HTTP calls
    updateUserSpy = spyOn(
      (controller as any).adminService,
      'updateUserInformation'
    ).mockResolvedValue(undefined)
  })

  afterEach(() => {
    mock.restore()
  })

  it('should return 400 if userId is missing', async () => {
    req.params.id = ''
    req.body.displayName = ''

    await controller.handle(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Missing user ID'
    })
    expect(updateUserSpy).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 400 if no fields to update are provided', async () => {
    req.body = {}

    await controller.handle(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      message: 'No valid fields to update'
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
