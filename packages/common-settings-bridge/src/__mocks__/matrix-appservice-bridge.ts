// Mock for matrix-appservice-bridge module

export class Logger {
  static configure = jest.fn()

  debug = jest.fn()
  info = jest.fn()
  warn = jest.fn()
  error = jest.fn()

  constructor(name?: string) {
    // Mock constructor
  }
}

// Shared mock methods that all Bridge instances will use
const sharedBridgeMethods = {
  run: jest.fn().mockResolvedValue(undefined),
  getBot: jest.fn().mockReturnValue({
    getUserId: jest.fn().mockReturnValue('@bot:example.com')
  }),
  getIntent: jest.fn()
}

// Shared mock intent instance
const mockIntent = {
  ensureRegistered: jest.fn().mockResolvedValue(undefined),
  setDisplayName: jest.fn().mockResolvedValue(undefined),
  setAvatarUrl: jest.fn().mockResolvedValue(undefined),
  matrixClient: {
    adminApis: {
      synapse: {
        isSelfAdmin: jest.fn().mockResolvedValue(true),
        upsertUser: jest.fn().mockResolvedValue(undefined)
      }
    },
    uploadContentFromUrl: jest
      .fn()
      .mockResolvedValue('mxc://example.com/avatar123')
  }
}

// Set up getIntent to return the shared mockIntent
sharedBridgeMethods.getIntent.mockReturnValue(mockIntent)

export class Bridge {
  run = sharedBridgeMethods.run
  getBot = sharedBridgeMethods.getBot
  getIntent = sharedBridgeMethods.getIntent

  constructor(config: any) {
    // All instances share the same mock methods
  }
}

export class Intent {
  ensureRegistered = jest.fn().mockResolvedValue(undefined)
  setDisplayName = jest.fn().mockResolvedValue(undefined)
  setAvatarUrl = jest.fn().mockResolvedValue(undefined)
  matrixClient = {
    adminApis: {
      synapse: {
        isSelfAdmin: jest.fn().mockResolvedValue(true),
        upsertUser: jest.fn().mockResolvedValue(undefined)
      }
    },
    uploadContentFromUrl: jest
      .fn()
      .mockResolvedValue('mxc://example.com/avatar123')
  }

  constructor() {
    // Return the shared mock intent instance
    return mockIntent as any
  }
}
