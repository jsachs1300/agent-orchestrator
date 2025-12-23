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
      req_id: "REQ-1",
      title: "Requirement 1",
      priority: { tier: "p0", rank: 1 },
      overall_status: "not_started",
      sections: {
        pm: { status: "unaddressed", direction: "", feedback: "", decision: "pending" },
        architect: { status: "unaddressed", design_spec: "" },
        coder: { status: "unaddressed", implementation_notes: "", pr: null },
        tester: {
          status: "unaddressed",
          test_plan: "",
          test_cases: [],
          test_results: { status: "", notes: "" }
        }
      }
    }
  }
});

const roles = ["pm", "architect", "coder", "tester", "system"] as const;

type Role = (typeof roles)[number];

const withHeaders = (role: Role) => ({
  "X-Agent-Role": role,
  "X-Agent-Id": `${role}-1`
});

describe("requirements auth", () => {
  beforeEach(() => {
    (getState as ReturnType<typeof vi.fn>).mockImplementation(async () => baseState());
    (setState as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("returns 401 when X-Agent-Role is missing", async () => {
    const response = await request(app)
      .get("/v1/requirements")
      .set("X-Agent-Id", "agent-1");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });

  it("returns 401 when X-Agent-Id is missing", async () => {
    const response = await request(app)
      .get("/v1/requirements")
      .set("X-Agent-Role", "pm");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });

  it("allows all roles to read requirements", async () => {
    for (const role of roles) {
      const listResponse = await request(app)
        .get("/v1/requirements")
        .set(withHeaders(role));

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.requirements).toBeDefined();

      const itemResponse = await request(app)
        .get("/v1/requirements/REQ-1")
        .set(withHeaders(role));

      expect(itemResponse.status).toBe(200);
      expect(itemResponse.body.req_id).toBe("REQ-1");
    }
  });

  it("enforces role-based writes for each endpoint", async () => {
    const cases: Array<{ role: Role; path: string; body: object; allowed: Role }> = [
      {
        role: "pm",
        path: "/v1/requirements/REQ-1/pm",
        body: {
          section: { status: "in_progress", direction: "dir", feedback: "", decision: "pending" },
          priority: { tier: "p0", rank: 1 }
        },
        allowed: "pm"
      },
      {
        role: "architect",
        path: "/v1/requirements/REQ-1/architecture",
        body: { section: { status: "in_progress", design_spec: "spec" } },
        allowed: "architect"
      },
      {
        role: "coder",
        path: "/v1/requirements/REQ-1/engineering",
        body: { section: { status: "in_progress", implementation_notes: "notes", pr: null } },
        allowed: "coder"
      },
      {
        role: "tester",
        path: "/v1/requirements/REQ-1/qa",
        body: {
          section: {
            status: "in_progress",
            test_plan: "plan",
            test_cases: [],
            test_results: { status: "", notes: "" }
          }
        },
        allowed: "tester"
      },
      {
        role: "pm",
        path: "/v1/requirements/REQ-1/status",
        body: { overall_status: "in_progress" },
        allowed: "pm"
      }
    ];

    for (const testCase of cases) {
      for (const role of roles) {
        const response = await request(app)
          .put(testCase.path)
          .set(withHeaders(role))
          .send(testCase.body);

        if (role === testCase.allowed) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(401);
        }
      }
    }
  });

  it("allows only pm to bulk create", async () => {
    const body = {
      requirements: [
        { req_id: "REQ-2", title: "Requirement 2", priority: { tier: "p1", rank: 1 } }
      ]
    };

    for (const role of roles) {
      const response = await request(app)
        .post("/v1/requirements/bulk")
        .set(withHeaders(role))
        .send(body);

      if (role === "pm") {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(401);
      }
    }
  });

  it("rejects invalid section status values", async () => {
    const response = await request(app)
      .put("/v1/requirements/REQ-1/architecture")
      .set(withHeaders("architect"))
      .send({ section: { status: "invalid", design_spec: "spec" } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_body");
  });
});
