import amqp from 'amqplib'
import { randomUUID } from 'crypto'
import readline from 'readline'

// --- Configuration ---
// RabbitMQ connection details from environment variables or defaults
const rabbitmqConfig = {
  protocol: process.env.RABBITMQ_TLS === 'true' ? 'amqps' : 'amqp',
  hostname: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
  username: process.env.RABBITMQ_USERNAME || 'guest',
  password: process.env.RABBITMQ_PASSWORD || 'guest',
  vhost: process.env.RABBITMQ_VHOST || '/'
}

// Exchange and routing key from environment variables or defaults
const exchangeName = process.env.EXCHANGE_NAME || 'settings exchange'
const routingKey = process.env.ROUTING_KEY || 'user.settings.updated'
// --- End Configuration ---

async function sendMessage(payload, nickname, version) {
  let connection
  try {
    // Connect to RabbitMQ
    console.log(
      `Connecting to RabbitMQ at ${rabbitmqConfig.protocol}://${rabbitmqConfig.hostname}:${rabbitmqConfig.port}...`
    )
    connection = await amqp.connect(rabbitmqConfig)
    const channel = await connection.createChannel()
    console.log('Connection successful.')

    // Assert the exchange exists (durable, topic type)
    await channel.assertExchange(exchangeName, 'topic', { durable: true })

    // Construct the message according to the CommonSettingsMessage interface
    const message = {
      source: 'test-helper',
      nickname,
      request_id: randomUUID(),
      timestamp: Date.now(),
      version,
      payload
    }

    const messageBuffer = Buffer.from(JSON.stringify(message))

    // Publish the message to the exchange with the specified routing key
    channel.publish(exchangeName, routingKey, messageBuffer)

    console.log(
      "Message sent to exchange '%s' with routing key '%s':",
      exchangeName,
      routingKey
    )
    console.log(JSON.stringify(message, null, 2))

    await channel.close()
  } catch (error) {
    console.error('Error sending message:', error)
  } finally {
    if (connection) {
      await connection.close()
      console.log('Connection closed.')
    }
  }
}

function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve))

  ;(async () => {
    console.log('Starting interactive message sender. Press Ctrl+C to exit.')
    console.log('Leave matrix_id empty to exit.')

    let version = 1

    while (true) {
      const matrix_id = await ask('Enter matrix_id (e.g., @user:matrix.org): ')
      if (!matrix_id) {
        break
      }

      const nversion = await ask(`Enter a version number: (${version})`)
      if (nversion) {
        version = parseInt(nversion, 10)
      }

      const display_name = await ask('Enter new display_name: ')
      const avatar = await ask('Enter new avatar URL (optional): ')

      if (!matrix_id) {
        console.error('Error: matrix_id is a required argument.')
        continue
      }

      const nickname = matrix_id.startsWith('@')
        ? matrix_id.split(':')[0].substring(1)
        : matrix_id

      const payload = {
        matrix_id: matrix_id
      }

      if (display_name) {
        payload.display_name = display_name
      }

      if (avatar) {
        payload.avatar = avatar
      }

      try {
        await sendMessage(payload, nickname, version)
        version += 1
      } catch (error) {
        console.error('Failed to send message:', error)
      }
    }

    rl.close()
    console.log('Exiting.')
  })()
}

main()
