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

const defaultSliceResponse = {
  ...baseSlice,
  status: "not_started",
  deliverables: {
    architect: { design_spec: null },
    coder: { implementation_notes: null, pr: null },
    tester: { test_plan: null, test_results: null }
  },
  evidence: []
};

beforeEach(() => {
  clearSlicesStore();
});

describe("v2 slices endpoints", () => {
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
});
