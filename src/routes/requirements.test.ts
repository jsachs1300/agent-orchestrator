import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { State } from "../types/state.js";

vi.mock("../redis.js", () => ({
  getState: vi.fn(),
  setState: vi.fn()
}));

const { default: app } = await import("../app.js");
const { getState, setState } = await import("../redis.js");

const baseState = (): State => ({
  schema_version: "1.0",
  updated_at: new Date().toISOString(),
  requirements: {
    "REQ-1": {
      id: "REQ-1",
      title: "Requirement 1",
      priority: { tier: "p0", rank: 1 },
      status: "open",
      pm: { status: "unaddressed", direction: "", feedback: "", decision: "pending" },
      architecture: { status: "unaddressed", design_spec: "" },
      engineering: { status: "unaddressed", implementation_notes: "", pr: null },
      qa: {
        status: "unaddressed",
        test_plan: "",
        test_cases: [],
        test_results: { status: "", notes: "" }
      }
    }
  }
});

const withHeaders = (role: string) => ({
  "X-Agent-Role": role,
  "X-Agent-Id": "agent-1"
});

describe("requirements auth", () => {
  beforeEach(() => {
    (getState as ReturnType<typeof vi.fn>).mockResolvedValue(baseState());
    (setState as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("returns 401 when X-Agent-Role is missing", async () => {
    const response = await request(app)
      .get("/v1/requirements")
      .set("X-Agent-Id", "agent-1");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });

  it("returns 401 when role is not allowed for route", async () => {
    const response = await request(app)
      .put("/v1/requirements/REQ-1/architecture")
      .set(withHeaders("coder"))
      .send({ status: "in_progress", design_spec: "spec" });

    expect(response.status).toBe(401);
    expect(response.body.required_role).toBe("architect");
  });

  it("allows pm to update overall status", async () => {
    const response = await request(app)
      .put("/v1/requirements/REQ-1/status")
      .set(withHeaders("pm"))
      .send({ status: "done" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("done");
  });

  it("rejects non-pm overall status updates", async () => {
    const response = await request(app)
      .put("/v1/requirements/REQ-1/status")
      .set(withHeaders("coder"))
      .send({ status: "done" });

    expect(response.status).toBe(401);
    expect(response.body.required_role).toBe("pm");
  });

  it("rejects invalid section status values", async () => {
    const response = await request(app)
      .put("/v1/requirements/REQ-1/architecture")
      .set(withHeaders("architect"))
      .send({ status: "invalid", design_spec: "spec" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_body");
  });
});
