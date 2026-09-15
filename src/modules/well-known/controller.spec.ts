import { describe, expect, it } from "bun:test";

import { createLogger } from "winston";

import { wellKnownClientController } from "./controller";
import { WellKnownClientService } from "./service";
import type { WellKnownClientDocument } from "./types";

describe("wellKnownClientController", () => {
  it("should return the document from the service", () => {
    // Arrange: Create a real, silent logger to satisfy the type natively
    const silentLogger = createLogger({
      silent: true,
    });

    // Initialize the real service. We pass `enabled: false` to bypass its internal build logic.
    const service = new WellKnownClientService(
      {
        enabled: false,
      },
      silentLogger,
    );

    const mockDocument: WellKnownClientDocument = {
      "m.homeserver": {
        base_url: "https://matrix.example.com",
      },
    };

    // Override the document getter without any type assertions
    Object.defineProperty(service, "document", {
      get: () => mockDocument,
    });

    // Act
    const result = wellKnownClientController(service);

    // Assert
    expect(result).toEqual(mockDocument);
  });
});
