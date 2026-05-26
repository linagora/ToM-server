import config from "../../rollup-template.js";

export default config([
  "@linagora/rabbitmq-client",
  "@twake/db",
  "@twake/logger",
  "matrix-appservice-bridge",
  "amqplib",
  "pino",
]);
