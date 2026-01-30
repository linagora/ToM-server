import { MatrixProfileUpdater, type MatrixApis } from './matrix-profile-updater'
import { SynapseAdminRetryMode, type SettingsPayload } from './types'
import { type Logger, type Intent } from 'matrix-appservice-bridge'

describe('MatrixProfileUpdater', () => {
  let mockApis: jest.Mocked<MatrixApis>
  let mockIntent: jest.Mocked<Intent>
  let mockLogger: jest.Mocked<Logger>
  let mockMatrixClient: any

  beforeEach(() => {
    // Create mock matrix client
    mockMatrixClient = {
      uploadContentFromUrl: jest.fn(),
      uploadContent: jest.fn()
    }

    // Create mock intent
    mockIntent = {
      setDisplayName: jest.fn(),
      setAvatarUrl: jest.fn(),
      matrixClient: mockMatrixClient
    } as any

    // Create mock APIs
    mockApis = {
      getIntent: jest.fn().mockReturnValue(mockIntent),
      adminUpsertUser: jest.fn()
    }

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any

    // Mock global fetch
    global.fetch = jest.fn()
  })

  describe('updateDisplayName', () => {
    describe('DISABLED mode', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.DISABLED,
          mockLogger
        )
      })

      it('should use intent API successfully', async () => {
        mockIntent.setDisplayName.mockResolvedValue(undefined)

        await updater.updateDisplayName('@user:example.com', 'John Doe')

        expect(mockApis.getIntent).toHaveBeenCalledWith('@user:example.com')
        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('John Doe')
        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Updated display name for @user:example.com to "John Doe"'
        )
      })

      it('should throw error on failure without fallback', async () => {
        const error = new Error('Network error')
        mockIntent.setDisplayName.mockRejectedValue(error)

        await expect(
          updater.updateDisplayName('@user:example.com', 'John Doe')
        ).rejects.toThrow('Network error')

        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cannot update display name for @user:example.com, exhausted all methods'
        )
      })

      it('should throw on M_FORBIDDEN without fallback', async () => {
        const error = { errcode: 'M_FORBIDDEN', message: 'Forbidden' }
        mockIntent.setDisplayName.mockRejectedValue(error)

        await expect(
          updater.updateDisplayName('@user:example.com', 'John Doe')
        ).rejects.toMatchObject({ errcode: 'M_FORBIDDEN' })

        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
      })
    })

    describe('EXCLUSIVE mode', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.EXCLUSIVE,
          mockLogger
        )
      })

      it('should use admin API only', async () => {
        mockApis.adminUpsertUser.mockResolvedValue(undefined)

        await updater.updateDisplayName('@user:example.com', 'John Doe')

        expect(mockApis.adminUpsertUser).toHaveBeenCalledWith(
          '@user:example.com',
          { displayname: 'John Doe' }
        )
        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Updated display name via admin API for @user:example.com to "John Doe"'
        )
      })

      it('should throw error on admin API failure', async () => {
        const error = new Error('Admin API error')
        mockApis.adminUpsertUser.mockRejectedValue(error)

        await expect(
          updater.updateDisplayName('@user:example.com', 'John Doe')
        ).rejects.toThrow('Admin API error')

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Admin API failed to update display name for @user:example.com: Admin API error'
        )
      })
    })

    describe('FALLBACK mode', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.FALLBACK,
          mockLogger
        )
      })

      it('should use intent API successfully without fallback', async () => {
        mockIntent.setDisplayName.mockResolvedValue(undefined)

        await updater.updateDisplayName('@user:example.com', 'John Doe')

        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('John Doe')
        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Updated display name for @user:example.com to "John Doe"'
        )
      })

      it('should fall back to admin API on M_FORBIDDEN', async () => {
        const error = { errcode: 'M_FORBIDDEN', message: 'Forbidden' }
        mockIntent.setDisplayName.mockRejectedValue(error)
        mockApis.adminUpsertUser.mockResolvedValue(undefined)

        await updater.updateDisplayName('@user:example.com', 'John Doe')

        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('John Doe')
        expect(mockApis.adminUpsertUser).toHaveBeenCalledWith(
          '@user:example.com',
          { displayname: 'John Doe' }
        )
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Falling back to admin API for display name @user:example.com'
        )
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Updated display name via admin API for @user:example.com to "John Doe"'
        )
      })

      it('should throw on non-M_FORBIDDEN errors', async () => {
        const error = { errcode: 'M_UNKNOWN', message: 'Unknown error' }
        mockIntent.setDisplayName.mockRejectedValue(error)

        await expect(
          updater.updateDisplayName('@user:example.com', 'John Doe')
        ).rejects.toMatchObject({ errcode: 'M_UNKNOWN' })

        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cannot update display name for @user:example.com, exhausted all methods'
        )
      })
    })
  })

  describe('updateAvatar', () => {
    describe('MXC URL handling', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.DISABLED,
          mockLogger
        )
      })

      it('should use MXC URL directly without upload', async () => {
        const mxcUrl = 'mxc://example.com/abc123'
        mockIntent.setAvatarUrl.mockResolvedValue(undefined)

        await updater.updateAvatar('@user:example.com', mxcUrl)

        expect(mockMatrixClient.uploadContentFromUrl).not.toHaveBeenCalled()
        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(mxcUrl)
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Avatar URL is already MXC format: ${mxcUrl}`
        )
      })
    })

    describe('HTTP URL handling', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.DISABLED,
          mockLogger
        )
      })

      it('should upload HTTP URL via fetch and uploadContent', async () => {
        const httpUrl = 'https://example.com/avatar.png'
        const mxcUrl = 'mxc://example.com/uploaded123'
        const mockBuffer = Buffer.from('fake-image-data')

        // Mock fetch response
        const mockResponse = {
          ok: true,
          headers: {
            get: jest.fn((header: string) => {
              if (header === 'content-type') return 'image/png'
              if (header === 'content-length') return '1024'
              return null
            })
          },
          arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
        }
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        mockMatrixClient.uploadContent.mockResolvedValue(mxcUrl)
        mockIntent.setAvatarUrl.mockResolvedValue(undefined)

        await updater.updateAvatar('@user:example.com', httpUrl)

        expect(global.fetch).toHaveBeenCalledWith(
          httpUrl,
          expect.objectContaining({
            signal: expect.any(AbortSignal)
          })
        )
        expect(mockMatrixClient.uploadContent).toHaveBeenCalledWith(
          expect.any(Buffer),
          'image/png',
          'avatar'
        )
        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(mxcUrl)
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Downloading avatar from external URL for @user:example.com: ${httpUrl}`
        )
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Uploaded avatar to Synapse for @user:example.com: ${mxcUrl}`
        )
      })

      it('should propagate upload errors', async () => {
        const httpUrl = 'https://example.com/avatar.png'
        const error = new Error('Upload failed')

        // Mock fetch to succeed
        const mockBuffer = Buffer.from('fake-image-data')
        const mockResponse = {
          ok: true,
          headers: {
            get: jest.fn((header: string) => {
              if (header === 'content-type') return 'image/png'
              if (header === 'content-length') return '1024'
              return null
            })
          },
          arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
        }
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        // But uploadContent fails
        mockMatrixClient.uploadContent.mockRejectedValue(error)

        await expect(
          updater.updateAvatar('@user:example.com', httpUrl)
        ).rejects.toThrow('Upload failed')

        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to download/upload avatar for @user:example.com from ${httpUrl}: Upload failed`
        )
      })

      it('should reject avatars exceeding size limit via content-length header', async () => {
        const httpUrl = 'https://example.com/huge-avatar.png'
        const tooLargeSize = 6 * 1024 * 1024 // 6MB (exceeds 5MB limit)

        const mockResponse = {
          ok: true,
          headers: {
            get: jest.fn((header: string) => {
              if (header === 'content-type') return 'image/png'
              if (header === 'content-length') return String(tooLargeSize)
              return null
            })
          },
          arrayBuffer: jest.fn()
        }
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        await expect(
          updater.updateAvatar('@user:example.com', httpUrl)
        ).rejects.toThrow('Avatar too large')

        expect(mockResponse.arrayBuffer).not.toHaveBeenCalled()
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })

      it('should reject avatars exceeding size limit after download', async () => {
        const httpUrl = 'https://example.com/avatar.png'
        const tooLargeBuffer = Buffer.alloc(6 * 1024 * 1024) // 6MB

        const mockResponse = {
          ok: true,
          headers: {
            get: jest.fn((header: string) => {
              if (header === 'content-type') return 'image/png'
              // No content-length header
              return null
            })
          },
          arrayBuffer: jest.fn().mockResolvedValue(tooLargeBuffer.buffer)
        }
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        await expect(
          updater.updateAvatar('@user:example.com', httpUrl)
        ).rejects.toThrow('Avatar too large')

        expect(mockMatrixClient.uploadContent).not.toHaveBeenCalled()
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })

      it('should timeout on slow avatar downloads', async () => {
        jest.useFakeTimers()
        const httpUrl = 'https://example.com/slow-avatar.png'

        // Mock fetch to simulate abort
        ;(global.fetch as jest.Mock).mockImplementation((url, options) => {
          return new Promise((resolve, reject) => {
            // Simulate the abort signal behavior
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                const abortError = new Error('The operation was aborted')
                abortError.name = 'AbortError'
                reject(abortError)
              })
            }
          })
        })

        const updatePromise = updater.updateAvatar('@user:example.com', httpUrl)

        // Fast-forward time to trigger timeout
        jest.advanceTimersByTime(10000)

        await expect(updatePromise).rejects.toThrow(
          'Avatar fetch timed out after 10000ms'
        )

        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()

        jest.useRealTimers()
      })

      it('should handle HTTP errors from external URLs', async () => {
        const httpUrl = 'https://example.com/missing.png'

        const mockResponse = {
          ok: false,
          status: 404,
          statusText: 'Not Found'
        }
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        await expect(
          updater.updateAvatar('@user:example.com', httpUrl)
        ).rejects.toThrow('HTTP 404: Not Found')

        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })
    })

    describe('DISABLED mode', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.DISABLED,
          mockLogger
        )
      })

      it('should use intent API successfully', async () => {
        const mxcUrl = 'mxc://example.com/abc123'
        mockIntent.setAvatarUrl.mockResolvedValue(undefined)

        await updater.updateAvatar('@user:example.com', mxcUrl)

        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(mxcUrl)
        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
      })

      it('should throw on error without fallback', async () => {
        const mxcUrl = 'mxc://example.com/abc123'
        const error = new Error('Network error')
        mockIntent.setAvatarUrl.mockRejectedValue(error)

        await expect(
          updater.updateAvatar('@user:example.com', mxcUrl)
        ).rejects.toThrow('Network error')

        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
      })
    })

    describe('EXCLUSIVE mode', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.EXCLUSIVE,
          mockLogger
        )
      })

      it('should use admin API only', async () => {
        const mxcUrl = 'mxc://example.com/abc123'
        mockApis.adminUpsertUser.mockResolvedValue(undefined)

        await updater.updateAvatar('@user:example.com', mxcUrl)

        expect(mockApis.adminUpsertUser).toHaveBeenCalledWith(
          '@user:example.com',
          { avatar_url: mxcUrl }
        )
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })
    })

    describe('FALLBACK mode', () => {
      let updater: MatrixProfileUpdater

      beforeEach(() => {
        updater = new MatrixProfileUpdater(
          mockApis,
          SynapseAdminRetryMode.FALLBACK,
          mockLogger
        )
      })

      it('should fall back to admin API on M_FORBIDDEN', async () => {
        const mxcUrl = 'mxc://example.com/abc123'
        const error = { errcode: 'M_FORBIDDEN', message: 'Forbidden' }
        mockIntent.setAvatarUrl.mockRejectedValue(error)
        mockApis.adminUpsertUser.mockResolvedValue(undefined)

        await updater.updateAvatar('@user:example.com', mxcUrl)

        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(mxcUrl)
        expect(mockApis.adminUpsertUser).toHaveBeenCalledWith(
          '@user:example.com',
          { avatar_url: mxcUrl }
        )
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Falling back to admin API for avatar @user:example.com'
        )
      })

      it('should throw on non-M_FORBIDDEN errors', async () => {
        const mxcUrl = 'mxc://example.com/abc123'
        const error = { errcode: 'M_UNKNOWN', message: 'Unknown error' }
        mockIntent.setAvatarUrl.mockRejectedValue(error)

        await expect(
          updater.updateAvatar('@user:example.com', mxcUrl)
        ).rejects.toMatchObject({ errcode: 'M_UNKNOWN' })

        expect(mockApis.adminUpsertUser).not.toHaveBeenCalled()
      })
    })
  })

  describe('processChanges', () => {
    let updater: MatrixProfileUpdater

    beforeEach(() => {
      updater = new MatrixProfileUpdater(
        mockApis,
        SynapseAdminRetryMode.DISABLED,
        mockLogger
      )
      mockIntent.setDisplayName.mockResolvedValue(undefined)
      mockIntent.setAvatarUrl.mockResolvedValue(undefined)
    })

    const createPayload = (
      overrides?: Partial<SettingsPayload>
    ): SettingsPayload => ({
      language: 'en',
      timezone: 'UTC',
      avatar: 'mxc://example.com/avatar',
      last_name: 'Doe',
      first_name: 'John',
      email: 'john@example.com',
      phone: '+1234567890',
      matrix_id: '@john:example.com',
      display_name: 'John Doe',
      ...overrides
    })

    describe('display name changes', () => {
      it('should update display name when changed', async () => {
        const oldPayload = createPayload({ display_name: 'Old Name' })
        const newPayload = createPayload({ display_name: 'New Name' })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('New Name')
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })

      it('should not update display name when unchanged', async () => {
        const oldPayload = createPayload({ display_name: 'Same Name' })
        const newPayload = createPayload({ display_name: 'Same Name' })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'No profile changes detected for @user:example.com'
        )
      })

      it('should skip update when new display name is empty', async () => {
        const oldPayload = createPayload({ display_name: 'Old Name' })
        const newPayload = createPayload({ display_name: '' })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Display name changed but new value is empty for @user:example.com'
        )
      })
    })

    describe('avatar changes', () => {
      it('should update avatar when changed', async () => {
        const oldPayload = createPayload({ avatar: 'mxc://example.com/old' })
        const newPayload = createPayload({ avatar: 'mxc://example.com/new' })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(
          'mxc://example.com/new'
        )
        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
      })

      it('should not update avatar when unchanged', async () => {
        const oldPayload = createPayload({ avatar: 'mxc://example.com/same' })
        const newPayload = createPayload({ avatar: 'mxc://example.com/same' })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })

      it('should skip update when new avatar is empty', async () => {
        const oldPayload = createPayload({ avatar: 'mxc://example.com/old' })
        const newPayload = createPayload({ avatar: '' })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Avatar changed but new value is empty for @user:example.com'
        )
      })
    })

    describe('no changes', () => {
      it('should skip all updates when nothing changed', async () => {
        const oldPayload = createPayload()
        const newPayload = createPayload()

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'No profile changes detected for @user:example.com'
        )
      })
    })

    describe('new user handling', () => {
      it('should update both display name and avatar for new user', async () => {
        const newPayload = createPayload({
          display_name: 'New User',
          avatar: 'mxc://example.com/avatar'
        })

        await updater.processChanges(
          '@user:example.com',
          null,
          newPayload,
          true
        )

        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('New User')
        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(
          'mxc://example.com/avatar'
        )
      })

      it('should update only display name for new user when avatar empty', async () => {
        const newPayload = createPayload({
          display_name: 'New User',
          avatar: ''
        })

        await updater.processChanges(
          '@user:example.com',
          null,
          newPayload,
          true
        )

        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('New User')
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })

      it('should update only avatar for new user when display name empty', async () => {
        const newPayload = createPayload({
          display_name: '',
          avatar: 'mxc://example.com/avatar'
        })

        await updater.processChanges(
          '@user:example.com',
          null,
          newPayload,
          true
        )

        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(
          'mxc://example.com/avatar'
        )
      })

      it('should not update anything for new user when both values empty', async () => {
        const newPayload = createPayload({
          display_name: '',
          avatar: ''
        })

        await updater.processChanges(
          '@user:example.com',
          null,
          newPayload,
          true
        )

        expect(mockIntent.setDisplayName).not.toHaveBeenCalled()
        expect(mockIntent.setAvatarUrl).not.toHaveBeenCalled()
      })
    })

    describe('both fields changed', () => {
      it('should update both display name and avatar when both changed', async () => {
        const oldPayload = createPayload({
          display_name: 'Old Name',
          avatar: 'mxc://example.com/old'
        })
        const newPayload = createPayload({
          display_name: 'New Name',
          avatar: 'mxc://example.com/new'
        })

        await updater.processChanges(
          '@user:example.com',
          oldPayload,
          newPayload,
          false
        )

        expect(mockIntent.setDisplayName).toHaveBeenCalledWith('New Name')
        expect(mockIntent.setAvatarUrl).toHaveBeenCalledWith(
          'mxc://example.com/new'
        )
      })
    })
  })
})
