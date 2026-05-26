import axios from "axios";

// biome-ignore lint/suspicious/useAwait: jest async hook signature; configuration is synchronous
module.exports = async (): Promise<void> => {
  // Configure axios for tests to use.
  const host = process.env.HOST ?? "localhost";
  const port = process.env.PORT ?? "3000";
  axios.defaults.baseURL = `http://${host}:${port}`;
};
