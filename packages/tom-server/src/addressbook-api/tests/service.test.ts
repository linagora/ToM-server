import { TwakeDB } from '../../types'
import { AddressbookService } from '../services'
import { type TwakeLogger } from '@twake/logger'

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('the addressbooK API service', () => {
  const service = new AddressbookService(
    dbMock as unknown as TwakeDB,
    loggerMock as unknown as TwakeLogger
  )

  describe('the list method', () => {
    it("should return an empty addressbook if the user doesn't have one", async () => {
      dbMock.get.mockResolvedValue([])

      const addressbook = await service.list('user-id')

      expect(addressbook).toEqual({ id: '', owner: 'user-id', contacts: [] })
    })

    it('should return the user addressbook correctly', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbook-id',
              owner: 'user-id'
            }
          ]
        }

        if (table === 'contacts') {
          return [
            {
              id: 'contact-id',
              addressbook_id: 'addressbook-id',
              display_name: 'contact-name',
              mxid: '@user:server.com'
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook).toEqual({
        id: 'addressbook-id',
        owner: 'user-id',
        contacts: [
          {
            id: 'contact-id',
            addressbook_id: 'addressbook-id',
            display_name: 'contact-name',
            mxid: '@user:server.com'
          }
        ]
      })
    })
  })

  describe('the delete method', () => {
    it('should delete the addressbook and all its contacts', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'addressbook-id',
          owner: 'user-id'
        }
      ])

      await service.delete('addressbook-id')

      expect(dbMock.deleteEqual).toHaveBeenNthCalledWith(
        1,
        'contacts',
        'addressbook_id',
        'addressbook-id'
      )
      expect(dbMock.deleteEqual).toHaveBeenNthCalledWith(
        2,
        'addressbooks',
        'id',
        'addressbook-id'
      )
    })

    it("should throw an error if the user doesn't have an addresbook", async () => {
      dbMock.get.mockResolvedValue([])

      await expect(service.delete('addressbook-id')).rejects.toThrow()
    })

    it('should throw if something wrong happens', async () => {
      dbMock.get.mockRejectedValue(new Error('something wrong'))

      await expect(service.delete('addressbook-id')).rejects.toThrow()
    })
  })

  describe('the getContact method', () => {
    it('should return the contact if it exists', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'contact-id',
          addressbook_id: 'addressbook-id',
          display_name: 'contact-name',
          mxid: '@user:server.com'
        }
      ])

      const contact = await service.getContact('contact-id')

      expect(contact).toEqual({
        id: 'contact-id',
        addressbook_id: 'addressbook-id',
        display_name: 'contact-name',
        mxid: '@user:server.com'
      })
    })

    it("should return undefined if the contact doesn't exist", async () => {
      dbMock.get.mockResolvedValue([])

      const result = await service.getContact('contact-id')
      expect(result).toBeUndefined()
    })

    it('should return undefined if something wrong happens', async () => {
      dbMock.get.mockRejectedValue(new Error('something wrong'))

      const result = await service.getContact('contact-id')
      expect(result).toBeUndefined()
    })
  })

  describe('the updateContact method', () => {
    it('should update the contact correctly', async () => {
      const contact = {
        id: 'contact-id',
        addressbook_id: 'addressbook-id',
        display_name: 'contact-name',
        mxid: '@user:server.com'
      }

      dbMock.update.mockResolvedValue([contact])

      const result = await service.updateContact('contact-id', {
        display_name: 'contact-name',
        mxid: '@user:server.com',
        active: 0
      })

      expect(result).toEqual(contact)
    })

    it('should avoid updating the user mxid', async () => {
      await service.updateContact('contact-id', {
        display_name: 'contact-name',
        mxid: '@user:server.com',
        active: 0
      })

      expect(dbMock.update).toHaveBeenCalledWith(
        'contacts',
        {
          display_name: 'contact-name',
          active: 0
        },
        'id',
        'contact-id'
      )
    })

    it('should return undefined if it fails to update the contact', async () => {
      dbMock.update.mockResolvedValue([])

      const result = await service.updateContact('contact-id', {
        display_name: 'contact-name',
        mxid: '@user:server.com',
        active: 0
      })

      expect(result).toBeUndefined()
    })
  })

  describe('the deleteContact method', () => {
    it('should delete the contact correctly', async () => {
      await service.deleteContact('contact-id')

      expect(dbMock.deleteEqual).toHaveBeenCalledWith(
        'contacts',
        'id',
        'contact-id'
      )
    })

    it('should throw if it fails to delete the contact', async () => {
      dbMock.deleteEqual.mockRejectedValue(new Error('something wrong'))

      await expect(service.deleteContact('contact-id')).rejects.toThrow()
    })
  })

  describe('the addContacts method', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const demoContacts = [
      {
        id: 'contact-id',
        display_name: 'contact-name',
        mxid: '@user:server.com',
        active: 0
      }
    ]

    describe('the user has an addressbook already', () => {
      it('should create contacts correctly', async () => {
        dbMock.get.mockImplementation((table) => {
          if (table === 'addressbooks') {
            return [
              {
                id: 'addressbook-id',
                owner: 'user-id'
              }
            ]
          }

          return []
        })

        dbMock.insert.mockResolvedValue(demoContacts)

        const result = await service.addContacts('user-id', demoContacts)

        expect(result).toEqual({
          id: 'addressbook-id',
          owner: 'user-id',
          contacts: demoContacts
        })
      })

      it('should avoid creating duplicate contacts', async () => {
        dbMock.get.mockImplementation((table) => {
          if (table === 'addressbooks') {
            return [
              {
                id: 'addressbook-id',
                owner: 'user-id'
              }
            ]
          }

          return [demoContacts]
        })

        const result = await service.addContacts('user-id', demoContacts)
        expect(result).toEqual({
          id: 'addressbook-id',
          owner: 'user-id',
          contacts: []
        })
      })
    })

    describe('the user does not have an addressbook', () => {
      it('should create an addressbook', async () => {
        dbMock.get.mockImplementation((table) => {
          if (table === 'addressbooks') {
            return []
          }

          return []
        })

        dbMock.insert.mockImplementation((table) => {
          if (table === 'addressbooks') {
            return [
              {
                id: 'addressbook-id',
                owner: 'user-id'
              }
            ]
          }

          return demoContacts
        })

        await service.addContacts('user-id', demoContacts)

        expect(dbMock.insert).toHaveBeenNthCalledWith(1, 'addressbooks', {
          owner: 'user-id',
          id: expect.any(String)
        })
      })
    })

    it('should return an undefined in case of an error', async () => {
      dbMock.get.mockRejectedValue(new Error('something wrong'))
      dbMock.insert.mockRejectedValue(new Error('something wrong'))

      const result = await service.addContacts('user-id', demoContacts)

      expect(result).toBeUndefined()
    })
  })
})
