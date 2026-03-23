import { TwakeDB } from '../../types'
import { AddressbookService } from '../services'
import { type TwakeLogger } from '@twake/logger'
import { Contact } from '../types'

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn()
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
              mxid: '@user:server.com',
              active: 1
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
            mxid: '@user:server.com',
            active: true
          }
        ]
      })
    })

    it('should deduplicate contacts with the same mxid, keeping the earliest created', async () => {
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
              id: '018d1234-2222-7abc-def0-123456789abc',
              addressbook_id: 'addressbook-id',
              display_name: 'Updated Name',
              mxid: '@user:server.com',
              active: 1
            },
            {
              id: '018d1234-1111-7abc-def0-123456789abc',
              addressbook_id: 'addressbook-id',
              display_name: 'Original Name',
              mxid: '@user:server.com',
              active: 0
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toHaveLength(1)
      expect(addressbook.contacts[0]).toEqual({
        id: '018d1234-1111-7abc-def0-123456789abc',
        addressbook_id: 'addressbook-id',
        display_name: 'Original Name',
        mxid: '@user:server.com',
        active: false
      })
    })

    it('should sort contacts alphabetically by display_name', async () => {
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
              id: 'contact-id-3',
              addressbook_id: 'addressbook-id',
              display_name: 'Zoe',
              mxid: '@zoe:server.com',
              active: 1
            },
            {
              id: 'contact-id-1',
              addressbook_id: 'addressbook-id',
              display_name: 'Alice',
              mxid: '@alice:server.com',
              active: 1
            },
            {
              id: 'contact-id-2',
              addressbook_id: 'addressbook-id',
              display_name: 'Bob',
              mxid: '@bob:server.com',
              active: 1
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toHaveLength(3)
      expect(addressbook.contacts[0].display_name).toBe('Alice')
      expect(addressbook.contacts[1].display_name).toBe('Bob')
      expect(addressbook.contacts[2].display_name).toBe('Zoe')
    })

    it('should filter out contacts with invalid or missing id', async () => {
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
              id: 'valid-contact-id',
              addressbook_id: 'addressbook-id',
              display_name: 'Valid Contact',
              mxid: '@valid:server.com',
              active: 1
            },
            {
              id: null,
              addressbook_id: 'addressbook-id',
              display_name: 'Invalid Contact',
              mxid: '@invalid:server.com',
              active: 1
            },
            {
              addressbook_id: 'addressbook-id',
              display_name: 'Missing ID',
              mxid: '@missing:server.com',
              active: 1
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toHaveLength(1)
      expect(addressbook.contacts[0].id).toBe('valid-contact-id')
    })

    it('should filter out contacts with invalid or missing mxid', async () => {
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
              id: 'valid-contact-id',
              addressbook_id: 'addressbook-id',
              display_name: 'Valid Contact',
              mxid: '@valid:server.com',
              active: 1
            },
            {
              id: 'invalid-contact-id-1',
              addressbook_id: 'addressbook-id',
              display_name: 'Invalid Contact',
              mxid: null,
              active: 1
            },
            {
              id: 'invalid-contact-id-2',
              addressbook_id: 'addressbook-id',
              display_name: 'Missing MXID',
              active: 1
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toHaveLength(1)
      expect(addressbook.contacts[0].mxid).toBe('@valid:server.com')
    })

    it('should convert active field to boolean', async () => {
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
              id: 'contact-id-1',
              addressbook_id: 'addressbook-id',
              display_name: 'Active Contact',
              mxid: '@active:server.com',
              active: 1
            },
            {
              id: 'contact-id-2',
              addressbook_id: 'addressbook-id',
              display_name: 'Inactive Contact',
              mxid: '@inactive:server.com',
              active: 0
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts[0].active).toBe(true)
      expect(addressbook.contacts[1].active).toBe(false)
    })

    it('should place contacts with empty display_name at the end', async () => {
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
              id: 'contact-id-1',
              addressbook_id: 'addressbook-id',
              display_name: '',
              mxid: '@nodisplay1:server.com',
              active: 1
            },
            {
              id: 'contact-id-2',
              addressbook_id: 'addressbook-id',
              display_name: 'Alice',
              mxid: '@alice:server.com',
              active: 1
            },
            {
              id: 'contact-id-3',
              addressbook_id: 'addressbook-id',
              display_name: null,
              mxid: '@nodisplay2:server.com',
              active: 1
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toHaveLength(3)
      expect(addressbook.contacts[0].display_name).toBe('Alice')
      expect(addressbook.contacts[1].display_name).toBe('')
      expect(addressbook.contacts[2].display_name).toBeNull()
    })

    it('should handle complex deduplication scenario with multiple duplicates', async () => {
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
              id: '018d1234-3333-7abc-def0-123456789abc',
              addressbook_id: 'addressbook-id',
              display_name: 'User Three',
              mxid: '@user:server.com',
              active: 1
            },
            {
              id: '018d1234-1111-7abc-def0-123456789abc',
              addressbook_id: 'addressbook-id',
              display_name: 'User One',
              mxid: '@user:server.com',
              active: 1
            },
            {
              id: '018d1234-2222-7abc-def0-123456789abc',
              addressbook_id: 'addressbook-id',
              display_name: 'User Two',
              mxid: '@user:server.com',
              active: 0
            },
            {
              id: '018d5678-1111-7abc-def0-123456789abc',
              addressbook_id: 'addressbook-id',
              display_name: 'Another User',
              mxid: '@another:server.com',
              active: 1
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toHaveLength(2)
      expect(addressbook.contacts[0].mxid).toBe('@another:server.com')
      expect(addressbook.contacts[1].mxid).toBe('@user:server.com')
      expect(addressbook.contacts[1].id).toBe(
        '018d1234-1111-7abc-def0-123456789abc'
      )
      expect(addressbook.contacts[1].display_name).toBe('User One')
    })

    it('should return empty contacts array when database returns non-array', async () => {
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
          return null
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toEqual([])
    })

    it('should return empty contacts array when all contacts are invalid', async () => {
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
              id: null,
              addressbook_id: 'addressbook-id',
              display_name: 'No ID',
              mxid: '@noid:server.com',
              active: 1
            },
            {
              id: 'contact-id',
              addressbook_id: 'addressbook-id',
              display_name: 'No MXID',
              mxid: null,
              active: 1
            }
          ]
        }
      })

      const addressbook = await service.list('user-id')

      expect(addressbook.contacts).toEqual([])
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
          mxid: '@user:server.com',
          active: 1
        }
      ])

      const contact = await service.getContact('contact-id')

      expect(contact).toEqual({
        id: 'contact-id',
        addressbook_id: 'addressbook-id',
        display_name: 'contact-name',
        mxid: '@user:server.com',
        active: true
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
        mxid: '@user:server.com',
        active: 0
      }

      dbMock.update.mockResolvedValue([contact])

      const result = await service.updateContact('contact-id', {
        display_name: 'contact-name',
        mxid: '@user:server.com'
      })

      expect(result).toEqual({ ...contact, active: false })
    })

    it('should avoid updating the user mxid', async () => {
      await service.updateContact('contact-id', {
        display_name: 'contact-name',
        mxid: '@user:server.com',
        active: false
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
        mxid: '@user:server.com'
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
        mxid: '@user:server.com'
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

        dbMock.insert.mockResolvedValue(
          demoContacts.map((contact) => ({
            ...contact,
            active: 1,
            addressbook_id: 'addressbook-id'
          }))
        )

        const result = await service.addContacts('user-id', demoContacts)

        expect(result).toEqual({
          id: 'addressbook-id',
          owner: 'user-id',
          contacts: demoContacts.map((contact) => ({
            ...contact,
            active: true,
            addressbook_id: 'addressbook-id'
          }))
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
