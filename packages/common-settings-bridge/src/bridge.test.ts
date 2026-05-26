import { RabbitMQClient } from "@linagora/rabbitmq-client";
import type { SynapseAdminApis } from "@vector-im/matrix-bot-sdk";
import { Bridge, type Intent } from "matrix-appservice-bridge";

import { Database } from "@twake/db";

import { CommonSettingsBridge } from "./bridge";
import { MatrixProfileUpdater } from "./matrix-profile-updater";
import { SettingsRepository } from "./settings-repository";
import type { BridgeConfig, ISettingsPayload, StoredUserSettings, UserSettingsTableName } from "./types";
import { SynapseAdminRetryMode } from "./types";

type MockAdminApis = jest.Mocked<Pick<SynapseAdminApis, "isSelfAdmin" | "upsertUser">>;
type MockRabbitClient = jest.Mocked<Pick<RabbitMQClient, "init" | "subscribe" | "close">>;
type MockBridgeInstance = jest.Mocked<Pick<Bridge, "run" | "getBot" | "getIntent">>;

// Mock external dependencies
jest.mock("./settings-repository");
jest.mock("./matrix-profile-updater");
jest.mock("@linagora/rabbitmq-client");
jest.mock("@twake/db");

describe("CommonSettingsBridge", () => {
  let bridge: CommonSettingsBridge;
  let mockConfig: BridgeConfig;
  let mockBridgeInstance: MockBridgeInstance;
  let mockIntent: jest.Mocked<Intent>;
  let mockDatabase: jest.Mocked<Database<UserSettingsTableName>>;
  let mockClient: MockRabbitClient;
  let mockSettingsRepo: jest.Mocked<SettingsRepository>;
  let mockProfileUpdater: jest.Mocked<MatrixProfileUpdater>;
  let mockAdminApis: MockAdminApis;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup config
    mockConfig = {
      homeserverUrl: "https://matrix.example.com",
      domain: "example.com",
      registrationPath: "/path/to/registration.yaml",
      database: {
        engine: "pg",
        host: "localhost",
        name: "testdb",
        user: "testuser",
        password: "testpass",
      },
      rabbitmq: {
        host: "localhost",
        port: 5672,
        username: "guest",
        password: "guest",
        vhost: "/",
        exchange: "test-exchange",
        queue: "test-queue",
        routingKey: "test.routing.key",
      },
      synapse: {
        adminRetryMode: "fallback",
      },
    };

    // Mock database. Jest's Mocked<T> isn't structurally compatible with the
    // raw class, so bridge through `unknown` to convert real -> mock and back.
    mockDatabase = {
      ready: Promise.resolve(),
      get: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      close: jest.fn(),
      ensureColumns: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Database<UserSettingsTableName>>;
    (Database as jest.MockedClass<typeof Database>).mockImplementation(
      () => mockDatabase as unknown as Database<string>,
    );

    // Mock RabbitMQ client
    mockClient = {
      init: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (RabbitMQClient as jest.MockedClass<typeof RabbitMQClient>).mockImplementation(
      () => mockClient as unknown as RabbitMQClient,
    );

    // The Bridge mock is handled by the manual mock in __mocks__
    // Create an instance to access the shared mock methods
    const tempBridge = new Bridge({} as ConstructorParameters<typeof Bridge>[0]);
    mockBridgeInstance = {
      run: tempBridge.run as jest.Mock,
      getBot: tempBridge.getBot as jest.Mock,
      getIntent: tempBridge.getIntent as jest.Mock,
    };

    // Get the shared mockIntent from the Bridge's getIntent mock
    mockIntent = mockBridgeInstance.getIntent() as jest.Mocked<Intent>;

    // Update mockAdminApis to reference the mockIntent's admin APIs
    mockAdminApis = mockIntent.matrixClient.adminApis.synapse as unknown as MockAdminApis;

    // Mock SettingsRepository
    mockSettingsRepo = {
      getUserSettings: jest.fn(),
      saveSettings: jest.fn(),
    } as unknown as jest.Mocked<SettingsRepository>;
    (SettingsRepository as jest.MockedClass<typeof SettingsRepository>).mockImplementation(() => mockSettingsRepo);

    // Mock MatrixProfileUpdater
    mockProfileUpdater = {
      processChanges: jest.fn().mockResolvedValue(undefined),
      updateDisplayName: jest.fn().mockResolvedValue(undefined),
      updateAvatar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixProfileUpdater>;
    (MatrixProfileUpdater as jest.MockedClass<typeof MatrixProfileUpdater>).mockImplementation(
      () => mockProfileUpdater,
    );
  });

  describe("constructor", () => {
    it("should initialize bridge instance with config", () => {
      bridge = new CommonSettingsBridge(mockConfig);

      expect(bridge).toBeInstanceOf(CommonSettingsBridge);
      expect(Database).toHaveBeenCalledWith(
        expect.objectContaining({
          database_engine: "pg",
          database_host: "localhost",
          database_name: "testdb",
          database_user: "testuser",
          database_password: "testpass",
        }),
        expect.any(Object),
        expect.objectContaining({
          usersettings: expect.any(String),
        }),
      );
    });

    it("should initialize RabbitMQ client with URL built from config", () => {
      bridge = new CommonSettingsBridge(mockConfig);

      expect(RabbitMQClient).toHaveBeenCalledWith({
        url: "amqp://guest:guest@localhost:5672//",
      });
    });
  });

  describe("start()", () => {
    beforeEach(() => {
      bridge = new CommonSettingsBridge(mockConfig);
    });

    it("should initialize Matrix bridge", async () => {
      await bridge.start();

      expect(mockBridgeInstance.run).toHaveBeenCalledWith(0);
    });

    it("should ensure bot is registered", async () => {
      await bridge.start();

      expect(mockBridgeInstance.getBot).toHaveBeenCalled();
      expect(mockBridgeInstance.getIntent).toHaveBeenCalledWith("@bot:example.com");
      expect(mockIntent.ensureRegistered).toHaveBeenCalled();
    });

    it("should check admin privileges", async () => {
      await bridge.start();

      expect(mockAdminApis.isSelfAdmin).toHaveBeenCalled();
    });

    it("should wait for database to be ready", async () => {
      const readyPromise = Promise.resolve();
      mockDatabase.ready = readyPromise;

      await bridge.start();

      await expect(readyPromise).resolves.toBeUndefined();
    });

    it("should initialize settings repository", async () => {
      await bridge.start();

      expect(SettingsRepository).toHaveBeenCalledWith(mockDatabase, expect.any(Object));
    });

    it("should initialize profile updater with correct retry mode", async () => {
      await bridge.start();

      expect(MatrixProfileUpdater).toHaveBeenCalledWith(
        expect.objectContaining({
          getIntent: expect.any(Function),
          adminUpsertUser: expect.any(Function),
        }),
        SynapseAdminRetryMode.FALLBACK,
        expect.any(Object),
        expect.objectContaining({
          maxSizeBytes: expect.any(Number),
          fetchTimeoutMs: expect.any(Number),
        }),
      );
    });

    it("should init RabbitMQ client and subscribe to the configured queue", async () => {
      await bridge.start();

      expect(mockClient.init).toHaveBeenCalled();
      expect(mockClient.subscribe).toHaveBeenCalledWith(
        "test-exchange",
        "test.routing.key",
        "test-queue",
        expect.any(Function),
      );
    });

    it("should default routingKey to '#' when omitted from config", async () => {
      const configNoRouting: BridgeConfig = {
        ...mockConfig,
        rabbitmq: { ...mockConfig.rabbitmq, routingKey: undefined },
      };
      const newBridge = new CommonSettingsBridge(configNoRouting);
      await newBridge.start();

      expect(mockClient.subscribe).toHaveBeenCalledWith("test-exchange", "#", "test-queue", expect.any(Function));
    });

    it("should close the RabbitMQ client if subscribe() fails after init() succeeded", async () => {
      mockClient.subscribe.mockRejectedValueOnce(new Error("PRECONDITION_FAILED"));

      const newBridge = new CommonSettingsBridge(mockConfig);
      await expect(newBridge.start()).rejects.toThrow("PRECONDITION_FAILED");

      expect(mockClient.init).toHaveBeenCalled();
      expect(mockClient.close).toHaveBeenCalled();
    });

    it("should handle startup errors", async () => {
      const error = new Error("Startup failed");
      mockBridgeInstance.run.mockRejectedValueOnce(error);

      const newBridge = new CommonSettingsBridge(mockConfig);
      await expect(newBridge.start()).rejects.toThrow("Startup failed");
    });
  });

  describe("stop()", () => {
    beforeEach(async () => {
      bridge = new CommonSettingsBridge(mockConfig);
      await bridge.start();
    });

    it("should close RabbitMQ client", async () => {
      await bridge.stop();

      expect(mockClient.close).toHaveBeenCalled();
    });

    it("should close database connection", async () => {
      await bridge.stop();

      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it("should handle shutdown errors", async () => {
      const error = new Error("Shutdown failed");
      mockClient.close.mockRejectedValue(error);

      await expect(bridge.stop()).rejects.toThrow("Shutdown failed");
    });

    it("should still close the database even if RabbitMQ client.close() rejects", async () => {
      mockClient.close.mockRejectedValueOnce(new Error("drain timeout"));

      await expect(bridge.stop()).rejects.toThrow("drain timeout");

      expect(mockClient.close).toHaveBeenCalled();
      expect(mockDatabase.close).toHaveBeenCalled();
    });
  });

  describe("#handleMessage orchestration", () => {
    // Typed as `unknown` so we can also pass non-object inputs (null/42/[]) to
    // exercise the runtime guards at the top of the handler.
    let handleMessageFn: (message: unknown) => Promise<void>;
    let mockUserSettings: StoredUserSettings | null;
    let mockPayload: ISettingsPayload;

    const buildMessage = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      source: "test-app",
      request_id: "req-123",
      timestamp: 1640995200000,
      version: 2,
      payload: mockPayload,
      ...overrides,
    });

    beforeEach(async () => {
      bridge = new CommonSettingsBridge(mockConfig);

      await bridge.start();

      const subscribeCall = (mockClient.subscribe as jest.Mock).mock.calls[0];
      handleMessageFn = subscribeCall[3];

      mockPayload = {
        matrix_id: "@user:example.com",
        display_name: "John Doe",
        avatar: "https://example.com/avatar.jpg",
        email: "john@example.com",
        phone: "+1234567890",
        language: "en",
        timezone: "UTC",
        last_name: "Doe",
        first_name: "John",
      };
    });

    it("should ack-and-drop a message missing request_id (no retry storm)", async () => {
      const message = buildMessage({ request_id: undefined });

      await expect(handleMessageFn(message)).resolves.toBeUndefined();
      expect(mockSettingsRepo.getUserSettings).not.toHaveBeenCalled();
      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled();
    });

    it("should ack-and-drop a message missing matrix_id in payload", async () => {
      const message = buildMessage({ version: 1, payload: { display_name: "Test" } });

      await expect(handleMessageFn(message)).resolves.toBeUndefined();
      expect(mockSettingsRepo.getUserSettings).not.toHaveBeenCalled();
      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled();
    });

    it("should ack-and-drop a non-object payload root", async () => {
      await expect(handleMessageFn(null)).resolves.toBeUndefined();
      await expect(handleMessageFn(42)).resolves.toBeUndefined();
      await expect(handleMessageFn([])).resolves.toBeUndefined();
      expect(mockSettingsRepo.getUserSettings).not.toHaveBeenCalled();
      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled();
    });

    it("should ack-and-drop a message whose timestamp is not finite", async () => {
      // `1e1000` round-trips through JSON.parse to Infinity; `typeof Infinity === "number"`.
      // Without the Number.isFinite guard, formatTimestamp(Infinity) throws inside the info log
      // and the lib retries → DLQ instead of the intended ack-and-drop.
      await expect(handleMessageFn(buildMessage({ timestamp: Number.POSITIVE_INFINITY }))).resolves.toBeUndefined();
      await expect(handleMessageFn(buildMessage({ timestamp: Number.NEGATIVE_INFINITY }))).resolves.toBeUndefined();
      await expect(handleMessageFn(buildMessage({ timestamp: Number.NaN }))).resolves.toBeUndefined();
      expect(mockSettingsRepo.getUserSettings).not.toHaveBeenCalled();
      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled();
    });

    it("should default version to 1 when version is not finite", async () => {
      mockSettingsRepo.getUserSettings.mockResolvedValue(null);

      await handleMessageFn(buildMessage({ version: Number.NaN }));
      await handleMessageFn(buildMessage({ version: Number.NEGATIVE_INFINITY, request_id: "req-2" }));

      // First call's `isNewUser` is true, so version defaulted to 1 was persisted.
      expect(mockSettingsRepo.saveSettings).toHaveBeenNthCalledWith(
        1,
        "@user:example.com",
        expect.any(Object),
        1,
        expect.any(Number),
        "req-123",
        true,
      );
    });

    it("should get user settings from repository", async () => {
      mockUserSettings = null;
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockSettingsRepo.getUserSettings).toHaveBeenCalledWith("@user:example.com");
    });

    it("should discard duplicate messages (same request_id)", async () => {
      mockUserSettings = {
        nickname: "@user:example.com",
        payload: mockPayload,
        version: 1,
        timestamp: 1640991600000,
        request_id: "req-123",
      };
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled();
      expect(mockSettingsRepo.saveSettings).not.toHaveBeenCalled();
    });

    it("should discard stale updates (lower version)", async () => {
      mockUserSettings = {
        nickname: "@user:example.com",
        payload: mockPayload,
        version: 5,
        timestamp: 1640998800000,
        request_id: "req-999",
      };
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled();
      expect(mockSettingsRepo.saveSettings).not.toHaveBeenCalled();
    });

    it("should process changes for new user", async () => {
      mockUserSettings = null;
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockProfileUpdater.processChanges).toHaveBeenCalledWith("@user:example.com", null, mockPayload);
    });

    it("should process changes for existing user with higher version", async () => {
      const oldPayload: ISettingsPayload = {
        matrix_id: "@user:example.com",
        display_name: "Old Name",
        avatar: "https://example.com/old-avatar.jpg",
        email: "old@example.com",
        phone: "+9876543210",
        language: "en",
        timezone: "UTC",
        last_name: "Doe",
        first_name: "John",
      };
      mockUserSettings = {
        nickname: "@user:example.com",
        payload: oldPayload,
        version: 1,
        timestamp: 1640991600000,
        request_id: "req-old",
      };
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockProfileUpdater.processChanges).toHaveBeenCalledWith("@user:example.com", oldPayload, mockPayload);
    });

    it("should save settings for new user", async () => {
      mockUserSettings = null;
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockSettingsRepo.saveSettings).toHaveBeenCalledWith(
        "@user:example.com",
        mockPayload,
        2,
        1640995200000,
        "req-123",
        true,
      );
    });

    it("should save settings for existing user", async () => {
      mockUserSettings = {
        nickname: "@user:example.com",
        payload: mockPayload,
        version: 1,
        timestamp: 1640991600000,
        request_id: "req-old",
      };
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      expect(mockSettingsRepo.saveSettings).toHaveBeenCalledWith(
        "@user:example.com",
        mockPayload,
        2,
        1640995200000,
        "req-123",
        false,
      );
    });

    it("should execute orchestration steps in correct order", async () => {
      mockUserSettings = {
        nickname: "@user:example.com",
        payload: {
          matrix_id: "@user:example.com",
          display_name: "Old Name",
          avatar: "https://example.com/old.jpg",
          email: "old@example.com",
          phone: "+9999999999",
          language: "en",
          timezone: "UTC",
          last_name: "Doe",
          first_name: "John",
        },
        version: 1,
        timestamp: 1640991600000,
        request_id: "req-old",
      };
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings);

      await handleMessageFn(buildMessage());

      const getSettingsOrder = mockSettingsRepo.getUserSettings.mock.invocationCallOrder[0];
      const processChangesOrder = mockProfileUpdater.processChanges.mock.invocationCallOrder[0];
      const saveSettingsOrder = mockSettingsRepo.saveSettings.mock.invocationCallOrder[0];

      expect(getSettingsOrder).toBeDefined();
      expect(processChangesOrder).toBeDefined();
      expect(saveSettingsOrder).toBeDefined();

      expect(getSettingsOrder).toBeLessThan(processChangesOrder);
      expect(processChangesOrder).toBeLessThan(saveSettingsOrder);
    });
  });
});
