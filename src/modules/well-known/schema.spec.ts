import { wellKnownClientDocumentSchema, wellKnownClientSettingsSchema } from "./schema";

describe("Well-Known Schemas", () => {
  describe("wellKnownClientSettingsSchema", () => {
    it("should successfully parse valid complete configurations", () => {
      const validData = {
        enabled: true,
        extra: {
          some_field: "value",
        },
        homeserver: {
          base_url: "https://matrix.example.com",
        },
      };

      const result = wellKnownClientSettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should apply defaults for 'enabled' and 'extra'", () => {
      const result = wellKnownClientSettingsSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
        expect(result.data.extra).toEqual({});
      }
    });
  });

  describe("wellKnownClientDocumentSchema", () => {
    it("should map explicit keys correctly", () => {
      const validData = {
        "m.homeserver": {
          base_url: "https://matrix.example.com",
        },
        "t.server": {
          base_url: "https://tom.example.com",
          server_name: "tom",
        },
      };

      const result = wellKnownClientDocumentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should allow arbitrary catchall properties to pass through", () => {
      const validData = {
        "m.homeserver": {
          base_url: "https://matrix.example.com",
        },
        "org.custom.property": "allowed",
        another_arbitrary_key: 12345,
      };

      const result = wellKnownClientDocumentSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data["org.custom.property"]).toBe("allowed");
        expect(result.data.another_arbitrary_key).toBe(12345);
      }
    });
  });
});
