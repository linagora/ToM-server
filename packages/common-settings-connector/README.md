# @twake/common-settings-connector
The common settings connector module listens for new changes applied to the user profile and applies them for chat using
the admin settings api.

## /lib
A simple TypeScript wrapper around [amqplib](https://www.npmjs.com/package/amqplib) that makes working with RabbitMQ queues and message consumption easier. It provides a minimal abstraction for connecting and consuming messages.