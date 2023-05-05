import { type MatrixDBBackend } from '@twake/matrix-identity-server'
import MutualRoomsService from '../services'

describe('the mutual rooms service', () => {
  const matrixDbMock = {
    get: jest.fn()
  }

  const mutualRoomsService = new MutualRoomsService(
    matrixDbMock as unknown as MatrixDBBackend
  )

  it('should get the list of mutual rooms', async () => {
    matrixDbMock.get.mockImplementation(
      async (
        table: string,
        _content: any,
        _selector: any,
        search: string
      ): Promise<any> => {
        if (table === 'room_memberships') {
          if (search === 'user1') {
            return [
              {
                room_id: 'room1',
                user_id: 'user1'
              },
              {
                room_id: 'room2',
                user_id: 'user1'
              }
            ]
          }

          return [
            {
              room_id: 'room2',
              user_id: 'user2'
            },
            {
              room_id: 'room3',
              user_id: 'user2'
            }
          ]
        }

        if (table === 'room_stats_state') {
          return [
            {
              room_id: search,
              name: `room ${search}`,
              topic: 'test',
              room_type: 'test'
            }
          ]
        }
      }
    )

    const result = await mutualRoomsService.fetchMutualRooms('user1', 'user2')
    expect(result).toEqual([
      {
        room_id: 'room2',
        name: 'room room2',
        topic: 'test',
        room_type: 'test'
      }
    ])
  })

  it('should return an empty list if there is no mutual room', async () => {
    matrixDbMock.get.mockImplementation(
      async (
        table: string,
        _content: any,
        _selector: any,
        search: string
      ): Promise<any> => {
        if (table === 'room_memberships') {
          if (search === 'user1') {
            return [
              {
                room_id: 'room1',
                user_id: 'user1'
              }
            ]
          }

          return [
            {
              room_id: 'room3',
              user_id: 'user2'
            }
          ]
        }

        if (table === 'room_stats_state') {
          return [
            {
              room_id: search,
              name: `room ${search}`,
              topic: 'test',
              room_type: 'test'
            }
          ]
        }
      }
    )

    const result = await mutualRoomsService.fetchMutualRooms('user1', 'user2')
    expect(result).toEqual([])
  })

  it('should return an empty list if the room information is not available', async () => {
    matrixDbMock.get.mockImplementation(
      async (
        table: string,
        _content: any,
        _selector: any,
        search: string
      ): Promise<any> => {
        if (table === 'room_memberships') {
          if (search === 'user1') {
            return [
              {
                room_id: 'room1',
                user_id: 'user1'
              }
            ]
          }

          return [
            {
              room_id: 'room1',
              user_id: 'user2'
            }
          ]
        }

        if (table === 'room_stats_state') {
          return []
        }
      }
    )

    const result = await mutualRoomsService.fetchMutualRooms('user1', 'user2')
    expect(result).toEqual([])
  })

  it('should throw an error if something wrong happens', async () => {
    matrixDbMock.get.mockRejectedValue(new Error('some random error'))

    await expect(
      mutualRoomsService.fetchMutualRooms('user1', 'user2')
    ).rejects.toThrowError('Failed to fetch mutual rooms')
  })

  it('should throw an error if something wrong happens when fetching room information', async () => {
    matrixDbMock.get.mockImplementation(
      async (
        table: string,
        _content: any,
        _selector: any,
        search: string
      ): Promise<any> => {
        if (table === 'room_memberships') {
          if (search === 'user1') {
            return [
              {
                room_id: 'room1',
                user_id: 'user1'
              }
            ]
          }

          return [
            {
              room_id: 'room1',
              user_id: 'user2'
            }
          ]
        }

        if (table === 'room_stats_state') {
          throw Error('some random error')
        }
      }
    )

    await expect(
      mutualRoomsService.fetchMutualRooms('user1', 'user2')
    ).rejects.toThrowError('Failed to fetch mutual rooms')
  })
})
