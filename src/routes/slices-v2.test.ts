import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import { clearSlicesStore } from "../store/slices-store.js";

const baseSlice = {
  slice_id: "SLICE-1",
  req_id: "REQ-1",
  title: "Initial slice",
  owner_role: "architect"
};

const pmHeaders = {
  "x-agent-role": "pm",
  "x-agent-id": "agent-1"
};

const coderHeaders = {
  "x-agent-role": "coder",
  "x-agent-id": "agent-2"
};

const architectHeaders = {
  "x-agent-role": "architect",
  "x-agent-id": "agent-3"
};

const testerHeaders = {
  "x-agent-role": "tester",
  "x-agent-id": "agent-4"
};

const defaultSliceResponse = {
  ...baseSlice,
  status: "not_started",
  deliverables: {
    architect: { design_spec: null, evidence: [] },
    coder: { implementation_notes: null, pr: null, evidence: [] },
    tester: { test_plan: null, test_results: null, evidence: [] }
  }
};

beforeEach(async () => {
  await clearSlicesStore();
});

describe("v2 slices endpoints", () => {
  async function createSlice() {
    await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({ slices: [baseSlice] });
  }

  it("returns 401 when headers are missing on POST", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .send({ slices: [baseSlice] });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when headers are missing on GET", async () => {
    const response = await request(app).get("/v1/slices/SLICE-1");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 for invalid role", async () => {
    const response = await request(app)
      .get("/v1/slices/SLICE-1")
      .set("x-agent-role", "system")
      .set("x-agent-id", "agent-3");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when agent id is empty", async () => {
    const response = await request(app)
      .get("/v1/slices/SLICE-1")
      .set("x-agent-role", "pm")
      .set("x-agent-id", " ");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 for non-pm role on POST", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(coderHeaders)
      .send({ slices: [baseSlice] });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 400 for unknown fields", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            extra: "nope"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for invalid owner_role", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            owner_role: "lead"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 when status is provided", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            status: "not_started"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 when deliverables are provided", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            deliverables: {
              architect: { design_spec: null },
              coder: { implementation_notes: null, pr: null },
              tester: { test_plan: null, test_results: null }
            }
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 when evidence is provided", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            evidence: []
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for invalid status", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            status: "in_progress"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for invalid depends_on entries", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            depends_on: [" "]
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for non-string depends_on entries", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            depends_on: [123]
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("accepts depends_on as non-empty strings", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({
        slices: [
          {
            ...baseSlice,
            depends_on: ["SLICE-0"]
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      slices: [
        {
          ...defaultSliceResponse,
          depends_on: ["SLICE-0"]
        }
      ]
    });
  });

  it("creates slices and defaults server fields", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({ slices: [baseSlice] });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      slices: [defaultSliceResponse]
    });
  });

  it("returns 409 for existing slice_id", async () => {
    await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({ slices: [baseSlice] });

    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({ slices: [baseSlice] });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "slice_exists",
      duplicates: ["SLICE-1"]
    });
  });

  it("returns 409 for duplicate slice_id in payload", async () => {
    const response = await request(app)
      .post("/v1/slices/bulk")
      .set(pmHeaders)
      .send({ slices: [baseSlice, { ...baseSlice }] });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "slice_exists",
      duplicates: ["SLICE-1"]
    });
  });

  it("returns 404 when slice is missing", async () => {
    const response = await request(app)
      .get("/v1/slices/SLICE-404")
      .set(pmHeaders);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it("returns 401 when headers are missing on PATCH endpoints", async () => {
    const responses = await Promise.all([
      request(app).patch("/v1/slices/SLICE-1/design").send({ design_spec: "Spec" }),
      request(app)
        .patch("/v1/slices/SLICE-1/implementation")
        .send({ implementation_notes: "Notes" }),
      request(app).patch("/v1/slices/SLICE-1/tests").send({ test_plan: "Plan" })
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    }
  });

  it("returns 401 for wrong role on PATCH endpoints", async () => {
    await createSlice();

    const responses = await Promise.all([
      request(app)
        .patch("/v1/slices/SLICE-1/design")
        .set(coderHeaders)
        .send({ design_spec: "Spec" }),
      request(app)
        .patch("/v1/slices/SLICE-1/implementation")
        .set(testerHeaders)
        .send({ implementation_notes: "Notes" }),
      request(app)
        .patch("/v1/slices/SLICE-1/tests")
        .set(architectHeaders)
        .send({ test_plan: "Plan" })
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    }
  });

  it("returns 404 when patching a missing slice", async () => {
    const responses = await Promise.all([
      request(app)
        .patch("/v1/slices/SLICE-404/design")
        .set(architectHeaders)
        .send({ design_spec: "Spec" }),
      request(app)
        .patch("/v1/slices/SLICE-404/implementation")
        .set(coderHeaders)
        .send({ implementation_notes: "Notes" }),
      request(app)
        .patch("/v1/slices/SLICE-404/tests")
        .set(testerHeaders)
        .send({ test_plan: "Plan" })
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
  });

  it("returns 400 for unknown fields in patch body", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({ design_spec: "Spec", extra: "nope" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("rejects cross-role fields in patch body", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({ design_spec: "Spec", implementation_notes: "Notes" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("does not erase other deliverables when patching different roles", async () => {
    await createSlice();

    const designResponse = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({ design_spec: "Spec v1" });

    expect(designResponse.status).toBe(200);
    expect(designResponse.body.deliverables.architect.design_spec).toBe("Spec v1");

    const implementationResponse = await request(app)
      .patch("/v1/slices/SLICE-1/implementation")
      .set(coderHeaders)
      .send({ implementation_notes: "Notes v1" });

    expect(implementationResponse.status).toBe(200);
    expect(implementationResponse.body.deliverables.architect.design_spec).toBe("Spec v1");
    expect(implementationResponse.body.deliverables.coder.implementation_notes).toBe("Notes v1");
  });

  it("appends evidence instead of replacing it", async () => {
    await createSlice();

    const firstResponse = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({
        design_spec: "Spec",
        evidence: [{ type: "file", ref: "spec.md" }]
      });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.deliverables.architect.evidence).toHaveLength(1);

    const secondResponse = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({
        design_spec: "Spec v2",
        evidence: [{ type: "command", ref: "make docs" }]
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.deliverables.architect.evidence).toHaveLength(2);
  });

  it("stores evidence only under the calling role", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/implementation")
      .set(coderHeaders)
      .send({
        implementation_notes: "Notes",
        evidence: [{ type: "pr", ref: "PR-123" }]
      });

    expect(response.status).toBe(200);
    expect(response.body.deliverables.coder.evidence).toHaveLength(1);
    expect(response.body.deliverables.architect.evidence).toHaveLength(0);
    expect(response.body.deliverables.tester.evidence).toHaveLength(0);
  });

  it("records evidence author info", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/tests")
      .set(testerHeaders)
      .send({
        test_plan: "Plan",
        evidence: [{ type: "test", ref: "Suite" }]
      });

    expect(response.status).toBe(200);
    expect(response.body.deliverables.tester.evidence).toHaveLength(1);
    expect(response.body.deliverables.tester.evidence[0]).toMatchObject({
      type: "test",
      ref: "Suite",
      author: { role: "tester", id: "agent-4" }
    });
    expect("result" in response.body.deliverables.tester.evidence[0]).toBe(false);
  });

  it("rejects status updates from patch requests", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({ design_spec: "Spec", status: "in_progress" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("rejects empty strings in patch payloads", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/implementation")
      .set(coderHeaders)
      .send({ implementation_notes: " " });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("rejects invalid evidence entries", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/tests")
      .set(testerHeaders)
      .send({
        test_plan: "Plan",
        evidence: [{ type: "artifact", ref: "file.txt", result: "pass" }]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("rejects invalid evidence results", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/tests")
      .set(testerHeaders)
      .send({
        test_plan: "Plan",
        evidence: [{ type: "test", ref: "Suite", result: "maybe" }]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("requires implementation_notes or pr in implementation patch", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/implementation")
      .set(coderHeaders)
      .send({ evidence: [{ type: "pr", ref: "PR-1" }] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("requires test_plan or test_results in tests patch", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/tests")
      .set(testerHeaders)
      .send({ evidence: [{ type: "test", ref: "Suite" }] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });
});
