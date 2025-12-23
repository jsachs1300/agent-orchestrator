import { describe, expect, it, vi } from "vitest";

describe("requirements storage", () => {
  it("returns empty map when no requirements are stored", async () => {
    vi.resetModules();

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      sendCommand: vi.fn().mockRejectedValue(new Error("ERR unknown command")),
      get: vi.fn().mockResolvedValue(null),
      sMembers: vi.fn().mockResolvedValue([])
    };

    vi.doMock("redis", () => ({
      createClient: vi.fn(() => mockClient)
    }));

    const { listRequirements } = await import("./redis.js");
    const requirements = await listRequirements();

    expect(requirements).toEqual({});
  });
});
