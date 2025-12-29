import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import { clearSlicesStore } from "../store/slices-store.js";

const baseSlice = {
  slice_id: "SLICE-RUN-1",
  req_id: "REQ-1",
  title: "Run next",
  owner_role: "architect",
  depends_on: []
};

const pmHeaders = {
  "x-agent-role": "pm",
  "x-agent-id": "agent-1"
};

const architectHeaders = {
  "x-agent-role": "architect",
  "x-agent-id": "agent-2"
};

const coderHeaders = {
  "x-agent-role": "coder",
  "x-agent-id": "agent-3"
};

const testerHeaders = {
  "x-agent-role": "tester",
  "x-agent-id": "agent-4"
};

beforeEach(async () => {
  await clearSlicesStore();
});

describe("v2 run next", () => {
  async function createSliceWithDeliverables() {
    await request(app).post("/v1/slices/bulk").set(pmHeaders).send({ slices: [baseSlice] });

    await request(app)
      .patch(`/v1/slices/${baseSlice.slice_id}/design`)
      .set(architectHeaders)
      .send({
        design_spec: "Spec",
        evidence: [{ type: "file", ref: "spec.md" }]
      });

    await request(app)
      .patch(`/v1/slices/${baseSlice.slice_id}/implementation`)
      .set(coderHeaders)
      .send({
        implementation_notes: "Notes",
        pr: "PR-1",
        evidence: [{ type: "pr", ref: "PR-1" }]
      });

    await request(app)
      .patch(`/v1/slices/${baseSlice.slice_id}/tests`)
      .set(testerHeaders)
      .send({
        test_plan: "Plan",
        test_results: { status: "pass", notes: "ok" },
        evidence: [{ type: "test", ref: "Suite" }]
      });
  }

  it("returns 401 when headers are missing", async () => {
    const response = await request(app).get("/v1/run/next").query({ role: "architect" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 400 for invalid role", async () => {
    const response = await request(app)
      .get("/v1/run/next")
      .set(pmHeaders)
      .query({ role: "pm" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_role" });
  });

  it("returns 404 when no eligible slices exist", async () => {
    const response = await request(app)
      .get("/v1/run/next")
      .set(coderHeaders)
      .query({ role: "coder" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it("returns next slice with architect view", async () => {
    await createSliceWithDeliverables();

    const response = await request(app)
      .get("/v1/run/next")
      .set(architectHeaders)
      .query({ role: "architect" });

    expect(response.status).toBe(200);
    expect(response.body.slice_id).toBe(baseSlice.slice_id);
    expect(response.body.view.slice).toMatchObject({
      slice_id: baseSlice.slice_id,
      req_id: baseSlice.req_id,
      title: baseSlice.title,
      owner_role: baseSlice.owner_role,
      status: "not_started",
      depends_on: baseSlice.depends_on,
      claimed_by: null,
      claimed_at: null,
      deliverables: {
        architect: { design_spec: "Spec" }
      }
    });
    expect(response.body.view.slice).not.toHaveProperty("evidence");
    expect(response.body.view.slice.deliverables).not.toHaveProperty("coder");
    expect(response.body.view.slice.deliverables).not.toHaveProperty("tester");
  });

  it("returns next slice with coder view", async () => {
    await createSliceWithDeliverables();

    const response = await request(app)
      .get("/v1/run/next")
      .set(coderHeaders)
      .query({ role: "architect" });

    expect(response.status).toBe(200);
    expect(response.body.slice_id).toBe(baseSlice.slice_id);
    expect(response.body.view.slice.deliverables).toMatchObject({
      architect: { design_spec: "Spec" },
      coder: { implementation_notes: "Notes", pr: "PR-1" }
    });
    expect(response.body.view.slice).not.toHaveProperty("evidence");
    expect(response.body.view.slice.deliverables).not.toHaveProperty("tester");
  });

  it("returns next slice with tester view", async () => {
    await createSliceWithDeliverables();

    const response = await request(app)
      .get("/v1/run/next")
      .set(testerHeaders)
      .query({ role: "architect" });

    expect(response.status).toBe(200);
    expect(response.body.slice_id).toBe(baseSlice.slice_id);
    expect(response.body.view.slice.deliverables).toMatchObject({
      architect: { design_spec: "Spec" },
      coder: { implementation_notes: "Notes", pr: "PR-1" },
      tester: { test_plan: "Plan", test_results: { status: "pass", notes: "ok" } }
    });
    expect(response.body.view.slice).not.toHaveProperty("evidence");
  });

  it("returns next slice with pm view", async () => {
    await createSliceWithDeliverables();

    const response = await request(app)
      .get("/v1/run/next")
      .set(pmHeaders)
      .query({ role: "architect" });

    expect(response.status).toBe(200);
    expect(response.body.slice_id).toBe(baseSlice.slice_id);
    expect(response.body.view.slice.deliverables.architect).toMatchObject({
      design_spec: "Spec"
    });
    expect(response.body.view.slice.deliverables.coder).toMatchObject({
      implementation_notes: "Notes",
      pr: "PR-1"
    });
    expect(response.body.view.slice.deliverables.tester).toMatchObject({
      test_plan: "Plan",
      test_results: { status: "pass", notes: "ok" }
    });
    expect(response.body.view.slice.evidence).toEqual([
      { type: "file", ref: "spec.md" },
      { type: "pr", ref: "PR-1" },
      { type: "test", ref: "Suite" }
    ]);
  });
});
