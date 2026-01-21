/* eslint-disable @typescript-eslint/promise-function-async */
import amqplib from 'amqplib'
import { AMQPConnector, ConnectionState } from './index.ts'
import {
  QueueNotSpecifiedError,
  MessageHandlerNotProvidedError,
  ExchangeNotSpecifiedError
} from './errors.ts'

jest.mock('amqplib')

describe('AMQPConnector', () => {
  const mockConsume = jest.fn()
  const mockAck = jest.fn()
  const mockNack = jest.fn()
  const mockCancel = jest.fn(() => Promise.resolve())
  const mockAssertExchange = jest.fn(() => Promise.resolve())
  const mockAssertQueue = jest.fn(() => Promise.resolve())
  const mockBindQueue = jest.fn(() => Promise.resolve())
  const mockChannelOn = jest.fn()
  const mockChannel = {
    assertExchange: mockAssertExchange,
    assertQueue: mockAssertQueue,
    bindQueue: mockBindQueue,
    consume: mockConsume,
    ack: mockAck,
    nack: mockNack,
    cancel: mockCancel,
    close: jest.fn(() => Promise.resolve()),
    on: mockChannelOn
  }

  const mockCreateChannel = jest.fn(() => Promise.resolve(mockChannel))
  const mockCloseConnection = jest.fn(() => Promise.resolve())
  const mockConnectionOn = jest.fn()
  const mockConnect = jest.fn(() =>
    Promise.resolve({
      createChannel: mockCreateChannel,
      close: mockCloseConnection,
      on: mockConnectionOn
    })
  )

  beforeAll(() => {
    ;(amqplib.connect as jest.Mock).mockImplementation(mockConnect)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockConsume.mockImplementation(() =>
      Promise.resolve({ consumerTag: 'test-tag' })
    )
  })

  it('should throw an error if exchange is not specified', async () => {
    await expect(new AMQPConnector().build()).rejects.toThrow(
      ExchangeNotSpecifiedError
    )
  })

  it('should throw an error if queue is not specified', async () => {
    await expect(
      new AMQPConnector().withExchange('test-exchange').build()
    ).rejects.toThrow(QueueNotSpecifiedError)
  })

  it('should throw an error if message handler is not provided', async () => {
    await expect(
      new AMQPConnector()
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .build()
    ).rejects.toThrow(MessageHandlerNotProvidedError)
  })

  it('should connect, assert queue, and call handler when a message is consumed', async () => {
    const fakeMsg = { content: Buffer.from('hello') }
    const mockHandler = jest.fn()

    // adjust mockConsume to call the callback with fakeMsg
    mockConsume.mockImplementation((_queue, cb) => {
      cb(fakeMsg)
      return Promise.resolve({ consumerTag: 'test-tag' })
    })

    const connector = new AMQPConnector()
      .withConfig({
        host: 'localhost',
        port: 5672,
        username: 'guest',
        password: 'guest',
        vhost: '/',
        tls: false
      })
      .withExchange('test-exchange')
      .withQueue('test-queue')
      .onMessage(mockHandler)

    await connector.build()

    expect(mockAssertExchange).toHaveBeenCalled()
    expect(mockAssertQueue).toHaveBeenCalled()
    expect(mockBindQueue).toHaveBeenCalled()
    expect(mockHandler).toHaveBeenCalledWith(fakeMsg, mockChannel)
    expect(mockAck).toHaveBeenCalledWith(fakeMsg)
  })

  it('should ignore null messages without throwing', async () => {
    let consumerCallback: any
    mockConsume.mockImplementation((_queue, cb) => {
      consumerCallback = cb
      return Promise.resolve({ consumerTag: 'test-tag' })
    })

    const handler = jest.fn()
    const connector = new AMQPConnector()
      .withUrl('amqp://localhost')
      .withExchange('test-exchange')
      .withQueue('test-queue')
      .onMessage(handler)

    await connector.build()
    consumerCallback(null)

    expect(handler).not.toHaveBeenCalled()
    expect(mockAck).not.toHaveBeenCalled()
  })

  it('should ack the message when handler succeeds', async () => {
    let consumerCallback: any
    mockConsume.mockImplementation((_queue, cb) => {
      consumerCallback = cb
      return Promise.resolve({ consumerTag: 'test-tag' })
    })

    const handler = jest.fn().mockResolvedValue(undefined)
    const connector = new AMQPConnector()
      .withUrl('amqp://localhost')
      .withExchange('test-exchange')
      .withQueue('test-queue')
      .onMessage(handler)

    await connector.build()

    const fakeMsg = { content: Buffer.from('test') }
    await consumerCallback(fakeMsg)

    expect(handler).toHaveBeenCalledWith(fakeMsg, expect.anything())
    expect(mockAck).toHaveBeenCalledWith(fakeMsg)
    expect(mockNack).not.toHaveBeenCalled()
  })

  it('should nack the message when handler throws an error', async () => {
    let consumerCallback: any
    mockConsume.mockImplementation((_queue, cb) => {
      consumerCallback = cb
      return Promise.resolve({ consumerTag: 'test-tag' })
    })

    const handler = jest.fn().mockRejectedValue(new Error('Invalid JSON'))
    const connector = new AMQPConnector()
      .withUrl('amqp://localhost')
      .withExchange('test-exchange')
      .withQueue('test-queue')
      .onMessage(handler)

    await connector.build()

    const fakeMsg = { content: Buffer.from('test') }
    await consumerCallback(fakeMsg)

    expect(handler).toHaveBeenCalledWith(fakeMsg, expect.anything())
    expect(mockAck).not.toHaveBeenCalled()
    expect(mockNack).toHaveBeenCalledWith(fakeMsg, false, false)
  })

  it('should close channel and connection on close()', async () => {
    const connector = new AMQPConnector()
      .withUrl('amqp://localhost')
      .withExchange('test-exchange')
      .withQueue('test-queue')
      .onMessage(jest.fn())

    await connector.build()
    await connector.close()

    expect(mockChannel.close).toHaveBeenCalled()
    expect(mockCloseConnection).toHaveBeenCalled()
  })
})

describe('AMQPConnector Reconnection', () => {
  const mockConsume = jest.fn()
  const mockAck = jest.fn()
  const mockNack = jest.fn()
  const mockCancel = jest.fn(() => Promise.resolve())
  const mockAssertExchange = jest.fn(() => Promise.resolve())
  const mockAssertQueue = jest.fn(() => Promise.resolve())
  const mockBindQueue = jest.fn(() => Promise.resolve())
  const mockChannelOn = jest.fn()
  const mockChannelClose = jest.fn(() => Promise.resolve())

  const createMockChannel = () => ({
    assertExchange: mockAssertExchange,
    assertQueue: mockAssertQueue,
    bindQueue: mockBindQueue,
    consume: mockConsume,
    ack: mockAck,
    nack: mockNack,
    cancel: mockCancel,
    close: mockChannelClose,
    on: mockChannelOn
  })

  const mockCreateChannel = jest.fn(() => Promise.resolve(createMockChannel()))
  const mockCloseConnection = jest.fn(() => Promise.resolve())
  const mockConnectionOn = jest.fn()

  const createMockConnection = () => ({
    createChannel: mockCreateChannel,
    close: mockCloseConnection,
    on: mockConnectionOn
  })

  const mockConnect = jest.fn(() => Promise.resolve(createMockConnection()))

  beforeAll(() => {
    ;(amqplib.connect as jest.Mock).mockImplementation(mockConnect)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockConsume.mockImplementation(() =>
      Promise.resolve({ consumerTag: 'test-tag' })
    )
  })

  describe('Connection State', () => {
    it('should start in Disconnected state', () => {
      const connector = new AMQPConnector()
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)
      expect(connector.isConnected()).toBe(false)
    })

    it('should be in Connected state after successful build', async () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await connector.build()

      expect(connector.getConnectionState()).toBe(ConnectionState.Connected)
      expect(connector.isConnected()).toBe(true)
    })

    it('should be in Disconnected state after close', async () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await connector.build()
      await connector.close()

      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)
      expect(connector.isConnected()).toBe(false)
    })

    it('should be in Disconnected state if build fails', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection failed'))

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await expect(connector.build()).rejects.toThrow('Connection failed')
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)
    })
  })

  describe('Reconnection Configuration', () => {
    it('should use default reconnection config', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      // Access private property for testing
      const config = (connector as any).reconnectionConfig
      expect(config.enabled).toBe(true)
      expect(config.initialDelayMs).toBe(1000)
      expect(config.maxDelayMs).toBe(30000)
      expect(config.maxRetries).toBe(0)
      expect(config.backoffMultiplier).toBe(2)
    })

    it('should allow custom reconnection config via builder', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({
          enabled: true,
          initialDelayMs: 500,
          maxDelayMs: 10000,
          maxRetries: 5,
          backoffMultiplier: 1.5
        })

      const config = (connector as any).reconnectionConfig
      expect(config.initialDelayMs).toBe(500)
      expect(config.maxDelayMs).toBe(10000)
      expect(config.maxRetries).toBe(5)
      expect(config.backoffMultiplier).toBe(1.5)
    })

    it('should allow disabling reconnection', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ enabled: false })

      const config = (connector as any).reconnectionConfig
      expect(config.enabled).toBe(false)
    })

    it('should merge partial config with defaults', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ maxRetries: 10 })

      const config = (connector as any).reconnectionConfig
      expect(config.enabled).toBe(true) // default
      expect(config.initialDelayMs).toBe(1000) // default
      expect(config.maxRetries).toBe(10) // overridden
    })
  })

  describe('Automatic Reconnection', () => {
    let connectionCloseCallback: () => void
    let connectionErrorCallback: (error: Error) => void

    beforeEach(() => {
      mockConnectionOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          connectionCloseCallback = callback
        } else if (event === 'error') {
          connectionErrorCallback = callback
        }
      })
    })

    it('should set up connection event handlers after build', async () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await connector.build()

      expect(mockConnectionOn).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      )
      expect(mockConnectionOn).toHaveBeenCalledWith(
        'close',
        expect.any(Function)
      )
    })

    it('should schedule reconnection when connection closes unexpectedly', async () => {
      jest.useFakeTimers()

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 1000 })

      await connector.build()

      // Clear previous connect calls
      mockConnect.mockClear()

      // Simulate unexpected connection close
      connectionCloseCallback()

      expect(connector.getConnectionState()).toBe(ConnectionState.Reconnecting)

      // Fast-forward timer
      jest.advanceTimersByTime(1100) // initialDelayMs + jitter

      // Should have attempted to reconnect
      expect(mockConnect).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })

    it('should not reconnect after intentional close', async () => {
      jest.useFakeTimers()

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 100 })

      await connector.build()
      mockConnect.mockClear()

      await connector.close()

      // Fast-forward timer
      jest.advanceTimersByTime(5000)

      // Should not have attempted to reconnect
      expect(mockConnect).not.toHaveBeenCalled()
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)

      jest.useRealTimers()
    })

    it('should not reconnect when reconnection is disabled', async () => {
      jest.useFakeTimers()

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ enabled: false })

      await connector.build()
      mockConnect.mockClear()

      // Simulate unexpected connection close
      connectionCloseCallback()

      // Fast-forward timer
      jest.advanceTimersByTime(5000)

      // Should not have attempted to reconnect
      expect(mockConnect).not.toHaveBeenCalled()

      jest.useRealTimers()
    })

    it('should stop reconnecting after max retries', async () => {
      jest.useFakeTimers()

      // Make connect always fail after initial build
      let buildComplete = false
      mockConnect.mockImplementation(() => {
        if (!buildComplete) {
          buildComplete = true
          return Promise.resolve(createMockConnection())
        }
        return Promise.reject(new Error('Connection failed'))
      })

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({
          maxRetries: 3,
          initialDelayMs: 100,
          backoffMultiplier: 1
        })

      await connector.build()
      mockConnect.mockClear()

      // Simulate unexpected connection close
      connectionCloseCallback()

      // Run through all retry attempts using advanceTimersByTimeAsync
      // to properly handle async promise resolution
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(200)
      }

      // Should have stopped at 3 retries
      expect(mockConnect).toHaveBeenCalledTimes(3)
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)

      jest.useRealTimers()
    })

    it('should reset retry count on successful reconnection', async () => {
      jest.useFakeTimers()

      // Reset mock to always succeed
      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 100 })

      await connector.build()

      // Simulate close then successful reconnect
      connectionCloseCallback()

      // Advance timer and flush all pending promises
      await jest.advanceTimersByTimeAsync(200)

      expect(connector.getConnectionState()).toBe(ConnectionState.Connected)
      expect((connector as any).reconnectAttempts).toBe(0)

      jest.useRealTimers()
    })
  })

  describe('Exponential Backoff', () => {
    it('should calculate increasing delays with backoff', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2
        })

      const calculateDelay = (connector as any).calculateReconnectDelay.bind(
        connector
      )

      // Mock Math.random to remove jitter for predictable testing
      const originalRandom = Math.random
      Math.random = () => 0
      ;(connector as any).reconnectAttempts = 0
      expect(calculateDelay()).toBe(1000) // 1000 * 2^0
      ;(connector as any).reconnectAttempts = 1
      expect(calculateDelay()).toBe(2000) // 1000 * 2^1
      ;(connector as any).reconnectAttempts = 2
      expect(calculateDelay()).toBe(4000) // 1000 * 2^2
      ;(connector as any).reconnectAttempts = 3
      expect(calculateDelay()).toBe(8000) // 1000 * 2^3

      Math.random = originalRandom
    })

    it('should cap delay at maxDelayMs', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          backoffMultiplier: 2
        })

      const calculateDelay = (connector as any).calculateReconnectDelay.bind(
        connector
      )

      // Mock Math.random to remove jitter
      const originalRandom = Math.random
      Math.random = () => 0
      ;(connector as any).reconnectAttempts = 10 // Would be 1024000ms without cap
      expect(calculateDelay()).toBe(5000)

      Math.random = originalRandom
    })

    it('should add jitter to delay', () => {
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2
        })

      const calculateDelay = (connector as any).calculateReconnectDelay.bind(
        connector
      )

      ;(connector as any).reconnectAttempts = 0

      // With jitter, delay should be between 1000 and 1100 (10% jitter)
      const delay = calculateDelay()
      expect(delay).toBeGreaterThanOrEqual(1000)
      expect(delay).toBeLessThanOrEqual(1100)
    })
  })

  describe('Close with pending reconnection', () => {
    it('should cancel pending reconnection timeout on close', async () => {
      jest.useFakeTimers()

      // Make reconnection fail to keep it pending
      let buildComplete = false
      mockConnect.mockImplementation(() => {
        if (!buildComplete) {
          buildComplete = true
          return Promise.resolve(createMockConnection())
        }
        return Promise.reject(new Error('Connection failed'))
      })

      let connectionCloseCallback: () => void = () => {}
      mockConnectionOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          connectionCloseCallback = callback
        }
      })

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 5000 })

      await connector.build()
      mockConnect.mockClear()

      // Simulate close which schedules reconnection
      connectionCloseCallback()
      expect(connector.getConnectionState()).toBe(ConnectionState.Reconnecting)

      // Close before reconnection timeout fires
      await connector.close()

      // Advance timer past reconnection delay
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Should not have attempted reconnection
      expect(mockConnect).not.toHaveBeenCalled()
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)

      jest.useRealTimers()
    })
  })

  describe('Build clears pending reconnect timer', () => {
    it('should clear pending reconnection timer when build() is called', async () => {
      jest.useFakeTimers()

      let connectionCloseCallback: () => void = () => {}
      mockConnectionOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          connectionCloseCallback = callback
        }
      })

      // First build succeeds
      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 5000 })

      await connector.build()

      // Simulate connection close to trigger reconnection scheduling
      connectionCloseCallback()
      expect(connector.getConnectionState()).toBe(ConnectionState.Reconnecting)

      mockConnect.mockClear()

      // Call build() again before reconnection timer fires
      await connector.build()

      // Advance timer past original reconnection delay
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Should have only connected once (from build()), not from scheduled reconnection
      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(connector.getConnectionState()).toBe(ConnectionState.Connected)

      jest.useRealTimers()
    })
  })

  describe('Channel-only reconnection', () => {
    let channelCloseCallback: () => void
    let connectionCloseCallback: () => void

    beforeEach(() => {
      mockChannelOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          channelCloseCallback = callback
        }
      })
      mockConnectionOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          connectionCloseCallback = callback
        }
      })
    })

    it('should recreate channel when channel closes but connection remains', async () => {
      jest.useFakeTimers()

      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await connector.build()

      // Clear to track new channel creation
      mockCreateChannel.mockClear()
      mockAssertExchange.mockClear()
      mockAssertQueue.mockClear()
      mockBindQueue.mockClear()
      mockConsume.mockClear()

      // Simulate channel-only close (connection still exists)
      channelCloseCallback()

      // Allow promises to resolve
      await jest.advanceTimersByTimeAsync(0)

      // Should have recreated the channel
      expect(mockCreateChannel).toHaveBeenCalledTimes(1)
      expect(mockAssertExchange).toHaveBeenCalledTimes(1)
      expect(mockAssertQueue).toHaveBeenCalledTimes(1)
      expect(mockBindQueue).toHaveBeenCalledTimes(1)
      expect(mockConsume).toHaveBeenCalledTimes(1)

      // Connection should NOT have been re-established
      expect(mockConnect).toHaveBeenCalledTimes(1) // Only from initial build

      jest.useRealTimers()
    })

    it('should not recreate channel on intentional close', async () => {
      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await connector.build()

      // Close intentionally
      await connector.close()

      mockCreateChannel.mockClear()

      // Simulate channel close event (would have been triggered by close())
      channelCloseCallback()

      await Promise.resolve()

      // Should NOT have tried to recreate channel
      expect(mockCreateChannel).not.toHaveBeenCalled()
    })

    it('should trigger full reconnection if channel recreation fails', async () => {
      jest.useFakeTimers()

      let channelCreationCount = 0
      mockCreateChannel.mockImplementation(() => {
        channelCreationCount++
        if (channelCreationCount === 1) {
          // First channel creation succeeds (during build)
          return Promise.resolve(createMockChannel())
        }
        // Subsequent channel creations fail
        return Promise.reject(new Error('Channel creation failed'))
      })

      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 100, enabled: true })

      await connector.build()

      mockConnect.mockClear()

      // Simulate channel close - recreation will fail
      channelCloseCallback()

      // Allow the failed channel recreation to complete
      await jest.advanceTimersByTimeAsync(0)

      // Should schedule full reconnection
      expect(connector.getConnectionState()).toBe(ConnectionState.Reconnecting)

      // Advance timer to trigger reconnection
      await jest.advanceTimersByTimeAsync(200)

      // Should have attempted full reconnection
      expect(mockConnect).toHaveBeenCalled()

      jest.useRealTimers()
    })
  })

  describe('Cleanup on build failure', () => {
    beforeEach(() => {
      // Reset mocks to default for these tests
      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )
      mockCreateChannel.mockImplementation(() =>
        Promise.resolve(createMockChannel())
      )
    })

    it('should cleanup partial resources when connection fails during build', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection failed'))

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await expect(connector.build()).rejects.toThrow('Connection failed')

      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)
      expect((connector as any).channel).toBeUndefined()
      expect((connector as any).connection).toBeUndefined()
      expect((connector as any).consumerTag).toBeUndefined()
    })

    it('should cleanup partial resources when channel creation fails during build', async () => {
      mockCreateChannel.mockRejectedValueOnce(
        new Error('Channel creation failed')
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      await expect(connector.build()).rejects.toThrow('Channel creation failed')

      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)
      expect((connector as any).channel).toBeUndefined()
      expect((connector as any).connection).toBeUndefined()
      // Connection close should have been called to cleanup
      expect(mockCloseConnection).toHaveBeenCalled()
    })
  })

  describe('Cleanup on reconnection failure', () => {
    it('should cleanup partial resources when reconnection fails', async () => {
      jest.useFakeTimers()

      // Reset mock to default for this test
      mockCreateChannel.mockImplementation(() =>
        Promise.resolve(createMockChannel())
      )

      let connectionCloseCallback: () => void = () => {}
      mockConnectionOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          connectionCloseCallback = callback
        }
      })

      // First build succeeds, subsequent connects fail
      let buildComplete = false
      mockConnect.mockImplementation(() => {
        if (!buildComplete) {
          buildComplete = true
          return Promise.resolve(createMockConnection())
        }
        return Promise.reject(new Error('Reconnection failed'))
      })

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 100, maxRetries: 1 })

      await connector.build()

      // Simulate connection close
      connectionCloseCallback()

      // Advance timer to trigger reconnection
      await jest.advanceTimersByTimeAsync(200)

      // After failed reconnection attempt, state should be disconnected
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)

      jest.useRealTimers()
    })
  })

  describe('Message handling when channel unavailable', () => {
    it('should handle message gracefully when channel becomes unavailable', async () => {
      // Reset mocks to default for this test
      mockConnect.mockImplementation(() =>
        Promise.resolve(createMockConnection())
      )
      mockCreateChannel.mockImplementation(() =>
        Promise.resolve(createMockChannel())
      )

      let consumerCallback: any
      mockConsume.mockImplementation((_queue, cb) => {
        consumerCallback = cb
        return Promise.resolve({ consumerTag: 'test-tag' })
      })

      const handler = jest.fn()
      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(handler)

      await connector.build()

      // Simulate channel becoming unavailable
      ;(connector as any).channel = undefined

      const fakeMsg = { content: Buffer.from('test') }
      await consumerCallback(fakeMsg)

      // Handler should not be called when channel is unavailable
      expect(handler).not.toHaveBeenCalled()
      expect(mockAck).not.toHaveBeenCalled()
      expect(mockNack).not.toHaveBeenCalled()
    })
  })

  describe('Race condition: close() during build()', () => {
    it('should cleanup when close() is called during build()', async () => {
      // Reset channel mock to default
      mockCreateChannel.mockImplementation(() =>
        Promise.resolve(createMockChannel())
      )

      // Slow down connect to simulate race condition
      let resolveConnect: (value: any) => void
      mockConnect.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConnect = resolve
          })
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())

      // Start build (will wait for connect)
      const buildPromise = connector.build()

      // Call close() while build is in progress
      const closePromise = connector.close()

      // Now resolve the connect
      resolveConnect!(createMockConnection())

      // Both should complete
      await Promise.all([buildPromise, closePromise])

      // Should be in disconnected state
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)
      expect((connector as any).channel).toBeUndefined()
      expect((connector as any).connection).toBeUndefined()
    })
  })

  describe('Race condition: close() during attemptReconnection()', () => {
    it('should cleanup when close() is called during reconnection', async () => {
      jest.useFakeTimers()

      // Reset mocks to default for this test
      mockCreateChannel.mockImplementation(() =>
        Promise.resolve(createMockChannel())
      )

      let connectionCloseCallback: () => void = () => {}
      mockConnectionOn.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          connectionCloseCallback = callback
        }
      })

      // First build succeeds
      mockConnect.mockImplementationOnce(() =>
        Promise.resolve(createMockConnection())
      )

      const connector = new AMQPConnector()
        .withUrl('amqp://localhost')
        .withExchange('test-exchange')
        .withQueue('test-queue')
        .onMessage(jest.fn())
        .withReconnection({ initialDelayMs: 100 })

      await connector.build()

      // Make next connect slow
      let resolveReconnect: (value: any) => void
      mockConnect.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReconnect = resolve
          })
      )

      // Trigger reconnection
      connectionCloseCallback()

      // Advance timer to start reconnection
      jest.advanceTimersByTime(200)

      // Call close() while reconnection is in progress
      const closePromise = connector.close()

      // Resolve the reconnect
      resolveReconnect!(createMockConnection())

      await closePromise
      await jest.advanceTimersByTimeAsync(0)

      // Should be in disconnected state
      expect(connector.getConnectionState()).toBe(ConnectionState.Disconnected)

      jest.useRealTimers()
    })
  })
})
