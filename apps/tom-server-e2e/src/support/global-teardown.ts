import { killPort } from "@nx/node/utils";

module.exports = async (): Promise<void> => {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await killPort(port);
  // biome-ignore lint/suspicious/noConsole: jest global teardown logs to the test runner
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
