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

  it("normalizes legacy requirement shapes from Redis", async () => {
    vi.resetModules();

    const legacyState = {
      schema_version: "1.0",
      updated_at: "2025-01-01T00:00:00Z",
      requirements: {
        "REQ-1": {
          id: "REQ-1",
          title: "Legacy requirement",
          priority: { tier: "p0", rank: 1 },
          status: "done",
          pm: { status: "complete", direction: "dir", feedback: "", decision: "approved" },
          architecture: { status: "complete", design_spec: "spec" },
          engineering: { status: "complete", implementation_notes: "notes", pr: null },
          qa: {
            status: "complete",
            test_plan: "plan",
            test_cases: [],
            test_results: { status: "pass", notes: "" }
          }
        }
      }
    };

    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      sendCommand: vi.fn().mockRejectedValue(new Error("ERR unknown command")),
      get: vi.fn().mockResolvedValue(JSON.stringify(legacyState)),
      set: vi.fn().mockResolvedValue("OK")
    };

    vi.doMock("redis", () => ({
      createClient: vi.fn(() => mockClient)
    }));

    const { getState } = await import("./redis.js");
    const state = await getState();

    const requirement = state.requirements["REQ-1"];
    expect(requirement.req_id).toBe("REQ-1");
    expect(requirement.overall_status).toBe("completed");
    expect(requirement.sections.pm.direction).toBe("dir");
    expect(requirement.sections.architect.design_spec).toBe("spec");
  });
});
