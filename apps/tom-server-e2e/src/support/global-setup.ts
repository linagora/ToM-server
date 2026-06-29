import { waitForPortOpen } from "@nx/node/utils";

declare global {
  // biome-ignore lint/suspicious/noVar: TypeScript requires `var` for global augmentation
  var __TEARDOWN_MESSAGE__: string;
}

module.exports = async (): Promise<void> => {
  // Start services that the app needs to run (e.g. database, docker-compose, etc.).
  // biome-ignore lint/suspicious/noConsole: jest global setup logs to the test runner
  console.log("\nSetting up...\n");

  const host = process.env.HOST ?? "localhost";
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await waitForPortOpen(port, { host });

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = "\nTearing down...\n";
};
