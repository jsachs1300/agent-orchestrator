import { describe, expect, it, vi } from "vitest";

describe("getState", () => {
  it("initializes empty state when Redis has no value", async () => {
    vi.resetModules();

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      sendCommand: vi.fn().mockRejectedValue(new Error("ERR unknown command")),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK")
    };

    vi.doMock("redis", () => ({
      createClient: vi.fn(() => mockClient)
    }));

    const { getState } = await import("./redis.js");
    const state = await getState();

    expect(state.schema_version).toBe("1.0");
    expect(state.requirements).toEqual({});
    expect(typeof state.updated_at).toBe("string");
  });
});
