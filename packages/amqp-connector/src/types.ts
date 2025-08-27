import { type Channel, type ConsumeMessage } from 'amqplib'

/**
 * Message handler function type
 * @param msg - The message to process
 * @param channel - The channel the message was received on
 * @returns void
 */
export type MessageHandler = (msg: ConsumeMessage, channel: Channel) => void
