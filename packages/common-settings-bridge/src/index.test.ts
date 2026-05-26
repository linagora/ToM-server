/* eslint-disable @typescript-eslint/promise-function-async */
import type { RabbitMQMessageHandler } from "@linagora/rabbitmq-client";

import type { BridgeConfig, ISettingsPayload } from "./types";

type LoggerWithConfigure = jest.Mock & { configure: jest.Mock };

// Must provide factory functions for mocks used at module load time
jest.mock("matrix-appservice-bridge", () => {
  const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const MockLogger: LoggerWithConfigure = Object.assign(
    jest.fn(() => mockLoggerInstance),
    { configure: jest.fn() },
  );

  return {
    Bridge: jest.fn(),
    Cli: jest.fn().mockImplementation(() => ({
      run: jest.fn(),
    })),
    AppServiceRegistration: {
      generateToken: jest.fn().mockReturnValue("mock-token"),
    },
    Logger: MockLogger,
  };
});

jest.mock("@linagora/rabbitmq-client", () => ({
  RabbitMQClient: jest.fn(),
}));

jest.mock("@twake/db", () => ({
  Database: jest.fn(),
}));

const mockUploadContentFromUrl = jest.fn(() => Promise.resolve("mxc://example.com/uploaded123"));
const mockUploadContent = jest.fn(() => Promise.resolve("mxc://example.com/uploaded123"));
const mockSetDisplayName = jest.fn(() => Promise.resolve());
const mockSetAvatarUrl = jest.fn(() => Promise.resolve());
const mockEnsureRegistered = jest.fn(() => Promise.resolve());
const mockIsSelfAdmin = jest.fn(() => Promise.resolve(true));
const mockUpsertUser = jest.fn(() => Promise.resolve());

const mockIntent = {
  ensureRegistered: mockEnsureRegistered,
  setDisplayName: mockSetDisplayName,
  setAvatarUrl: mockSetAvatarUrl,
  matrixClient: {
    uploadContentFromUrl: mockUploadContentFromUrl,
    uploadContent: mockUploadContent,
    adminApis: {
      synapse: {
        isSelfAdmin: mockIsSelfAdmin,
        upsertUser: mockUpsertUser,
      },
    },
  },
};

const mockRun = jest.fn(() => Promise.resolve());
const mockGetBot = jest.fn().mockReturnValue({
  getUserId: jest.fn().mockReturnValue("@bot:example.com"),
});
const mockGetIntent = jest.fn().mockReturnValue(mockIntent);

const mockBridge = {
  run: mockRun,
  getBot: mockGetBot,
  getIntent: mockGetIntent,
};

const mockDbGet = jest.fn().mockResolvedValue([] as unknown[]);
const mockDbInsert = jest.fn(() => Promise.resolve());
const mockDbUpdate = jest.fn(() => Promise.resolve());
const mockDbClose = jest.fn();
const mockDbEnsureColumns = jest.fn(() => Promise.resolve());

const mockDb = {
  ready: Promise.resolve(),
  get: mockDbGet,
  insert: mockDbInsert,
  update: mockDbUpdate,
  close: mockDbClose,
  ensureColumns: mockDbEnsureColumns,
};

const mockClientInit = jest.fn(() => Promise.resolve());
const mockClientClose = jest.fn(() => Promise.resolve());
let messageHandler: RabbitMQMessageHandler;

const mockClientSubscribe = jest.fn(
  (_exchange: string, _routingKey: string, _queue: string, handler: RabbitMQMessageHandler) => {
    messageHandler = handler;
    return Promise.resolve();
  },
);

const mockClient = {
  init: mockClientInit,
  subscribe: mockClientSubscribe,
  close: mockClientClose,
};

beforeAll(() => {
  const { Bridge } = jest.requireMock("matrix-appservice-bridge");
  Bridge.mockImplementation(() => mockBridge);

  const { RabbitMQClient } = jest.requireMock("@linagora/rabbitmq-client");
  RabbitMQClient.mockImplementation(() => mockClient);

  const { Database } = jest.requireMock("@twake/db");
  Database.mockImplementation(() => mockDb);
});

// Create a proper fetch mock for avatar downloads
const createMockFetchResponse = (options: { ok?: boolean; status?: number; statusText?: string } = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  statusText: options.statusText ?? "OK",
  headers: {
    get: (name: string) => {
      if (name === "content-length") return "1000";
      if (name === "content-type") return "image/png";
      return null;
    },
  },
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDbGet.mockResolvedValue([] as unknown[]);
  mockUploadContentFromUrl.mockResolvedValue("mxc://example.com/uploaded123");
  mockUploadContent.mockResolvedValue("mxc://example.com/uploaded123");
  // Mock global fetch for avatar downloads
  global.fetch = jest.fn(() => Promise.resolve(createMockFetchResponse())) as unknown as typeof fetch;
  // Re-bind capture after clearAllMocks
  mockClientSubscribe.mockImplementation(
    (_exchange: string, _routingKey: string, _queue: string, handler: RabbitMQMessageHandler) => {
      messageHandler = handler;
      return Promise.resolve();
    },
  );
});

const createTestConfig = (adminRetryMode: "disabled" | "fallback" | "exclusive" = "disabled"): BridgeConfig => ({
  homeserverUrl: "https://matrix.example.com",
  domain: "example.com",
  registrationPath: "/path/to/registration.yaml",
  synapse: {
    adminRetryMode,
  },
  rabbitmq: {
    host: "localhost",
    port: 5672,
    vhost: "/",
    username: "guest",
    password: "guest",
    tls: false,
    exchange: "common-settings",
    queue: "settings-updates",
    routingKey: "settings.update",
  },
  database: {
    engine: "sqlite",
    name: ":memory:",
  },
});

interface TestMessageOverrides {
  source?: string;
  nickname?: string;
  request_id?: string;
  timestamp?: number;
  version?: number;
  payload?: Partial<ISettingsPayload>;
}

const createTestMessage = (overrides: TestMessageOverrides = {}): Record<string, unknown> => ({
  source: "test-service",
  nickname: "test-user",
  request_id: "12345",
  timestamp: Date.now(),
  version: 1,
  payload: {
    matrix_id: "@user:example.com",
    display_name: "Test User",
    avatar: "mxc://example.com/avatar123",
    email: "test@example.com",
    phone: "+1234567890",
    language: "en",
    timezone: "UTC",
    first_name: "Test",
    last_name: "User",
    ...overrides.payload,
  },
  ...overrides,
});

describe("CommonSettingsBridge - Message Parsing", () => {
  it("should process a valid message", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    await messageHandler(createTestMessage());

    expect(mockDbInsert).toHaveBeenCalledWith(
      "usersettings",
      expect.objectContaining({
        matrix_id: "@user:example.com",
      }),
    );
  });

  it("should ack-and-drop messages where matrix_id is missing (no retry storm)", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    const testMessage = createTestMessage({
      payload: {
        display_name: "Test User",
      },
    });

    await expect(messageHandler(testMessage)).resolves.toBeUndefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

describe("CommonSettingsBridge - Avatar URL Resolution", () => {
  it("should use MXC URL directly when avatar starts with mxc://", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    const testMessage = createTestMessage({
      payload: {
        matrix_id: "@user:example.com",
        display_name: "Test User",
        avatar: "mxc://example.com/already-mxc",
      },
    });
    await messageHandler(testMessage);

    expect(mockUploadContentFromUrl).not.toHaveBeenCalled();
    expect(mockSetAvatarUrl).toHaveBeenCalledWith("mxc://example.com/already-mxc");
  });

  it("should download and upload HTTP avatar URL", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    const testMessage = createTestMessage({
      payload: {
        matrix_id: "@user:example.com",
        display_name: "Test User",
        avatar: "https://example.com/avatar.png",
      },
    });
    await messageHandler(testMessage);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/avatar.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockUploadContent).toHaveBeenCalled();
    expect(mockSetAvatarUrl).toHaveBeenCalledWith("mxc://example.com/uploaded123");
  });

  it("should propagate upload errors", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    mockUploadContent.mockRejectedValueOnce(new Error("Upload failed"));

    await bridge.start();

    const testMessage = createTestMessage({
      payload: {
        matrix_id: "@user:example.com",
        display_name: "Test User",
        avatar: "https://example.com/avatar.png",
      },
    });
    await expect(messageHandler(testMessage)).rejects.toThrow("Upload failed");
  });

  it("should use uploaded MXC URL with admin API in EXCLUSIVE mode", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig("exclusive");
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    const testMessage = createTestMessage({
      payload: {
        matrix_id: "@user:example.com",
        display_name: "Test User",
        avatar: "https://example.com/avatar.png",
      },
    });
    await messageHandler(testMessage);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/avatar.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockUploadContent).toHaveBeenCalled();
    expect(mockUpsertUser).toHaveBeenCalledWith("@user:example.com", {
      avatar_url: "mxc://example.com/uploaded123",
    });
    expect(mockSetAvatarUrl).not.toHaveBeenCalled();
  });
});

describe("CommonSettingsBridge - Matrix Updates", () => {
  it("should use admin API in EXCLUSIVE mode for display name", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig("exclusive");
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    const testMessage = createTestMessage();
    await messageHandler(testMessage);

    expect(mockUpsertUser).toHaveBeenCalledWith("@user:example.com", {
      displayname: "Test User",
    });
    expect(mockSetDisplayName).not.toHaveBeenCalled();
  });

  it("should use intent API in DISABLED mode for display name", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig("disabled");
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    const testMessage = createTestMessage();
    await messageHandler(testMessage);

    expect(mockSetDisplayName).toHaveBeenCalledWith("Test User");
  });

  it("should fallback to admin API on M_FORBIDDEN in FALLBACK mode", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig("fallback");
    const bridge = new CommonSettingsBridge(config);

    mockSetDisplayName.mockRejectedValueOnce({
      errcode: "M_FORBIDDEN",
      message: "Forbidden",
    });

    await bridge.start();

    const testMessage = createTestMessage();
    await messageHandler(testMessage);

    expect(mockSetDisplayName).toHaveBeenCalledWith("Test User");
    expect(mockUpsertUser).toHaveBeenCalledWith("@user:example.com", {
      displayname: "Test User",
    });
  });
});

describe("CommonSettingsBridge - Change Detection", () => {
  it("should not update display name when unchanged", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    const existingSettings = {
      matrix_id: "@user:example.com",
      settings: {
        matrix_id: "@user:example.com",
        display_name: "Test User",
        avatar: "mxc://example.com/avatar123",
      },
      version: 1,
      timestamp: Date.now() - 1000,
      request_id: "old-request",
    };

    mockDbGet.mockResolvedValue([existingSettings] as unknown[]);

    await bridge.start();

    const testMessage = createTestMessage();
    await messageHandler(testMessage);

    expect(mockSetDisplayName).not.toHaveBeenCalled();
    expect(mockSetAvatarUrl).not.toHaveBeenCalled();
  });

  it("should update display name when changed", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    const existingSettings = {
      matrix_id: "@user:example.com",
      settings: {
        matrix_id: "@user:example.com",
        display_name: "Old Name",
        avatar: "mxc://example.com/avatar123",
      },
      version: 1,
      timestamp: Date.now() - 1000,
      request_id: "old-request",
    };

    mockDbGet.mockResolvedValue([existingSettings] as unknown[]);

    await bridge.start();

    const testMessage = createTestMessage({
      payload: {
        matrix_id: "@user:example.com",
        display_name: "New Name",
        avatar: "mxc://example.com/avatar123",
      },
    });
    await messageHandler(testMessage);

    expect(mockSetDisplayName).toHaveBeenCalledWith("New Name");
    expect(mockSetAvatarUrl).not.toHaveBeenCalled();
  });
});

describe("CommonSettingsBridge - Lifecycle", () => {
  it("should start successfully", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    expect(mockRun).toHaveBeenCalledWith(0);
    expect(mockEnsureRegistered).toHaveBeenCalled();
    expect(mockClientInit).toHaveBeenCalled();
    expect(mockClientSubscribe).toHaveBeenCalled();
  });

  it("should stop successfully", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();
    await bridge.stop();

    expect(mockClientClose).toHaveBeenCalled();
    expect(mockDbClose).toHaveBeenCalled();
  });

  it("should check admin privileges on start", async () => {
    const { CommonSettingsBridge } = await import("./index");
    const config = createTestConfig();
    const bridge = new CommonSettingsBridge(config);

    await bridge.start();

    expect(mockIsSelfAdmin).toHaveBeenCalled();
  });
});
