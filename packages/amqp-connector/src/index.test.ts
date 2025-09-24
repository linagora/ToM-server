/* eslint-disable @typescript-eslint/promise-function-async */
import amqplib from 'amqplib'
import { AMQPConnector } from '.'
import {
  QueueNotSpecifiedError,
  MessageHandlerNotProvidedError,
  ExchangeNotSpecifiedError
} from './errors'

jest.mock('amqplib')

describe('AMQPConnector', () => {
  const mockConsume = jest.fn()
  const mockAck = jest.fn()
  const mockNack = jest.fn()
  const mockAssertExchange = jest.fn(() => Promise.resolve())
  const mockAssertQueue = jest.fn(() => Promise.resolve())
  const mockBindQueue = jest.fn(() => Promise.resolve())
  const mockChannel = {
    assertExchange: mockAssertExchange,
    assertQueue: mockAssertQueue,
    bindQueue: mockBindQueue,
    consume: mockConsume,
    ack: mockAck,
    nack: mockNack,
    close: jest.fn(() => Promise.resolve())
  }

  const mockCreateChannel = jest.fn(() => Promise.resolve(mockChannel))
  const mockCloseConnection = jest.fn(() => Promise.resolve())
  const mockConnect = jest.fn(() =>
    Promise.resolve({
      createChannel: mockCreateChannel,
      close: mockCloseConnection
    })
  )

  beforeAll(() => {
    ;(amqplib.connect as jest.Mock).mockImplementation(mockConnect)
  })

  beforeEach(() => {
    jest.clearAllMocks()
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
      return Promise.resolve()
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
      return Promise.resolve()
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
      return Promise.resolve()
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
      return Promise.resolve()
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
