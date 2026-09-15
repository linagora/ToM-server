import { createLogger } from "winston";

import { DomainError } from "../../errors/domain-error";
import { WellKnownClientService } from "./service";

const silentLogger = createLogger({
  silent: true,
});

const brokenConfig = {
  enabled: false,
  homeserver: {
    base_url: "not-a-url",
  },
  identityserver: 12345,
  extra: "should be an object",
};

const configuredServersConfig = {
  enabled: true,
  extra: {
    custom_key: "custom_value",
  },
  homeserver: {
    base_url: "https://matrix.example.com",
  },
  identityserver: {
    base_url: "https://identity.example.com",
  },
  tomserver: {
    base_url: "https://tom.example.com",
    server_name: "tom",
  },
  federatedIdentityServices: {
    base_urls: [
      "https://fed.example.com",
    ],
  },
};

const configuredServersDocument = {
  custom_key: "custom_value",
  "m.homeserver": {
    base_url: "https://matrix.example.com/",
  },
  "m.identity_server": {
    base_url: "https://identity.example.com/",
  },
  "t.server": {
    base_url: "https://tom.example.com/",
    server_name: "tom",
  },
  "m.federated_identity_services": {
    base_urls: [
      "https://fed.example.com/",
    ],
  },
};

const missingOptionalServersConfig = {
  enabled: true,
  homeserver: {
    base_url: "https://matrix.example.com",
  },
};

const invalidUrlConfig = {
  enabled: true,
  homeserver: {
    base_url: "not-a-valid-url",
  },
};

describe("WellKnownClientService", () => {
  it("should not throw when module is diabled even with bad config values", () => {
    let service: WellKnownClientService | undefined;

    expect(() => {
      // @ts-expect-error - intentionally passing completely invalid data alongside enabled: false
      service = new WellKnownClientService(brokenConfig, silentLogger);
    }).not.toThrow();

    expect(service?.document).toEqual({});
  });

  it("should successfully build the document with configured servers", () => {
    const service = new WellKnownClientService(configuredServersConfig, silentLogger);

    expect(service.document).toEqual(configuredServersDocument);
  });

  it("should safely handle missing optional servers without populating their keys", () => {
    const service = new WellKnownClientService(missingOptionalServersConfig, silentLogger);

    expect(service.document).toEqual({
      "m.homeserver": {
        base_url: "https://matrix.example.com/",
      },
    });
    expect(service.document).not.toHaveProperty("m.identity_server");
    expect(service.document).not.toHaveProperty("t.server");
  });

  it("should throw a DomainError if the configuration fails Zod validation", () => {
    expect(() => new WellKnownClientService(invalidUrlConfig, silentLogger)).toThrow(DomainError);
  });
});
