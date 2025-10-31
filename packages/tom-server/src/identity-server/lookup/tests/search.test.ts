import { _search } from '../_search'
import { send, errMsg, toMatrixId } from '@twake/utils'
import { AddressbookService } from '../../../addressbook-api/services'
import UserInfoService from '../../../user-info-api/services'

jest.mock('@twake/utils', () => ({
  send: jest.fn(),
  errMsg: jest.fn((msg) => ({ error: msg })),
  toMatrixId: jest.fn((uid, server) => `@${uid}:${server}`)
}))

jest.mock('../../../addressbook-api/services', () => ({
  AddressbookService: jest.fn().mockImplementation(() => ({
    list: jest.fn().mockResolvedValue({ contacts: [] })
  }))
}))

jest.mock('../../../user-info-api/services', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(function MockUserInfoService() {
      return {
        get: jest.fn().mockResolvedValue({
          uid: 'drwho',
          givenName: 'Dr',
          sn: 'Who',
          displayName: 'Dr Who',
          cn: 'Dr Who',
          mails: ['drwho@docker.localhost'],
          phones: ['1234 567890']
        })
      }
    })
  }
})

describe('_search factory', () => {
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }

  const idServerMock = {
    userDB: {
      match: jest.fn().mockResolvedValue([{ uid: 'drwho' }]),
      getAll: jest.fn().mockResolvedValue([{ uid: 'drwho' }])
    },
    db: {},
    matrixDb: {
      get: jest.fn().mockResolvedValue([{ name: '@drwho:server' }])
    },
    conf: { server_name: 'server', additional_features: true },
    logger
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return matches and inactive matches successfully', async () => {
    const searchFn = await _search(idServerMock as any, logger as any)

    const resMock = {} as any
    const dataMock = {
      fields: ['uid'],
      scope: ['uid'],
      val: 'drwho',
      owner: 'user123',
      offset: 0,
      limit: 10
    }

    await searchFn(resMock, dataMock)

    expect(send).toHaveBeenCalledWith(
      resMock,
      200,
      expect.objectContaining({
        matches: expect.any(Array),
        inactive_matches: expect.any(Array)
      })
    )

    expect(idServerMock.userDB.match).toHaveBeenCalled()
    expect(idServerMock.matrixDb.get).toHaveBeenCalled()
    expect(AddressbookService).toHaveBeenCalled()
    expect(UserInfoService).toHaveBeenCalled()
  })

  it('should return 400 if invalid field or scope detected', async () => {
    const searchFn = await _search(idServerMock as any, logger as any)

    const resMock = {} as any
    const dataMock = {
      fields: ['invalidField'],
      scope: ['invalidScope'],
      val: 'drwho'
    }

    await searchFn(resMock, dataMock)

    expect(send).toHaveBeenCalledWith(resMock, 400, { error: 'invalidParam' })
  })

  it('should handle unexpected errors gracefully', async () => {
    const brokenIdServer = {
      ...idServerMock,
      userDB: {
        match: jest.fn().mockRejectedValue(new Error('DB error'))
      }
    }

    const searchFn = await _search(brokenIdServer as any, logger as any)
    const resMock = {} as any

    await searchFn(resMock, {
      fields: ['uid'],
      scope: ['uid'],
      val: 'test'
    })

    expect(send).toHaveBeenCalledWith(resMock, 500, { error: 'invalidParam' })
  })

  it('should use only AddressBook when additional_features is false', async () => {
    const idServerWithoutUserDB = {
      ...idServerMock,
      conf: { server_name: 'server', additional_features: false }
    }

    const searchFn = await _search(idServerWithoutUserDB as any, logger as any)
    const resMock = {} as any
    const dataMock = {
      fields: ['uid'],
      scope: ['uid'],
      val: 'contact',
      owner: 'user123'
    }

    await searchFn(resMock, dataMock)

    expect(idServerWithoutUserDB.userDB.match).not.toHaveBeenCalled()
    expect(AddressbookService).toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith(
      resMock,
      200,
      expect.objectContaining({
        matches: expect.any(Array),
        inactive_matches: expect.any(Array)
      })
    )
  })

  it('should enrich returned users using UserInfoService', async () => {
    const searchFn = await _search(idServerMock as any, logger as any)
    const resMock = {} as any
    const dataMock = {
      fields: ['uid'],
      scope: ['uid'],
      val: 'drwho',
      owner: 'user123'
    }

    await searchFn(resMock, dataMock)

    const response = (send as jest.Mock).mock.calls[0][2]
    const firstMatch = response.matches[0]

    expect(firstMatch.uid).toBe('drwho')
    expect(firstMatch.givenName).toBe('Dr')
    expect(firstMatch.sn).toBe('Who')
    expect(firstMatch.mails).toContain('drwho@docker.localhost')
    expect(firstMatch.phones).toContain('1234 567890')
  })

  it('should return empty matches if no users or contacts found', async () => {
    const emptyServer = {
      ...idServerMock,
      userDB: {
        match: jest.fn().mockResolvedValue([]),
        getAll: jest.fn().mockResolvedValue([])
      },
      matrixDb: { get: jest.fn().mockResolvedValue([]) }
    }

    const searchFn = await _search(emptyServer as any, logger as any)
    const resMock = {} as any
    const dataMock = {
      fields: ['uid'],
      scope: ['uid'],
      val: 'nomatch',
      owner: 'user123'
    }

    await searchFn(resMock, dataMock)

    expect(send).toHaveBeenCalledWith(resMock, 200, {
      matches: [],
      inactive_matches: []
    })
  })

  it('should handle missing fields gracefully', async () => {
    const searchFn = await _search(idServerMock as any, logger as any)
    const resMock = {} as any
    const dataMock = {
      // fields intentionally undefined
      scope: ['uid'],
      val: 'drwho',
      owner: 'user123'
    }

    await searchFn(resMock, dataMock)

    expect(send).toHaveBeenCalledWith(
      resMock,
      200,
      expect.objectContaining({
        matches: expect.any(Array),
        inactive_matches: expect.any(Array)
      })
    )
  })
})
