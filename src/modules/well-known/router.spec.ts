import express from "express";
import request from "supertest";
import { createLogger } from "winston";

import { NOT_FOUND } from "../../errors/error-codes";
import { createWellKnownClientRouter } from "./router";
import type { WellKnownClientSettings } from "./types";

describe("WellKnownClientRouter", () => {
  const silentLogger = createLogger({
    silent: true,
  });

  const setupApp = (config: WellKnownClientSettings): express.Express => {
    const app = express();
    app.use(createWellKnownClientRouter(config, silentLogger));

    // biome-ignore lint/suspicious/noExplicitAny: Express err is loosely typed
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.code === NOT_FOUND ? 404 : 500).json({
        message: err.message,
        code: err.code,
      });
    });
    return app;
  };

  it("should throw DomainError(NOT_FOUND) and return 404 if route is disabled", async () => {
    const config = {
      enabled: false,
    };
    const app = setupApp(config);

    const response = await request(app).get("/.well-known/matrix/client");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("well-known matrix client route disabled");
  });

  it("should throw DomainError(NOT_FOUND) and return 404 if document resolves to empty", async () => {
    const config = {
      enabled: true,
    };
    const app = setupApp(config);

    const response = await request(app).get("/.well-known/matrix/client");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("well-known matrix client document is empty");
  });

  it("should return 200 with the formatted document payload on success", async () => {
    const config = {
      enabled: true,
      homeserver: {
        base_url: "https://matrix.example.com",
      },
    };
    const app = setupApp(config);

    const response = await request(app).get("/.well-known/matrix/client");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      "m.homeserver": {
        base_url: "https://matrix.example.com/",
      },
    });
  });
});
