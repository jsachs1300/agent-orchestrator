import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import { clearRequirementsStore } from "../store/requirements-store.js";

const baseRequirement = {
  req_id: "REQ-1",
  title: "First requirement",
  priority: "P0",
  acceptance: ["acceptance one"],
  constraints: ["constraint one"],
  source_ref: "REQUIREMENTS.md#one"
};

const pmHeaders = {
  "x-agent-role": "pm",
  "x-agent-id": "agent-1"
};

const coderHeaders = {
  "x-agent-role": "coder",
  "x-agent-id": "agent-2"
};

beforeEach(() => {
  clearRequirementsStore();
});

describe("v2 requirements endpoints", () => {
  it("returns 401 when headers are missing on POST", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .send({ requirements: [baseRequirement] });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when headers are missing on GET", async () => {
    const response = await request(app).get("/v1/requirements/REQ-1");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 for invalid role", async () => {
    const response = await request(app)
      .get("/v1/requirements/REQ-1")
      .set("x-agent-role", "system")
      .set("x-agent-id", "agent-3");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when agent id is empty", async () => {
    const response = await request(app)
      .get("/v1/requirements/REQ-1")
      .set("x-agent-role", "pm")
      .set("x-agent-id", " ");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 for non-pm role on POST", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(coderHeaders)
      .send({ requirements: [baseRequirement] });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 400 for unknown fields", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({
        requirements: [
          {
            ...baseRequirement,
            extra: "nope"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for invalid priority", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({
        requirements: [
          {
            ...baseRequirement,
            priority: "P9"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for blank acceptance entries", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({
        requirements: [
          {
            ...baseRequirement,
            acceptance: [" "]
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("returns 400 for blank constraints entries", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({
        requirements: [
          {
            ...baseRequirement,
            constraints: [" "]
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_body" });
  });

  it("creates requirements and defaults status", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({ requirements: [baseRequirement] });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      requirements: [
        {
          ...baseRequirement,
          status: "derived"
        }
      ]
    });
  });

  it("returns 409 for existing req_id", async () => {
    await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({ requirements: [baseRequirement] });

    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({ requirements: [baseRequirement] });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "requirement_exists",
      duplicates: ["REQ-1"],
      message: "One or more requirements already exist"
    });
  });

  it("returns 409 for duplicate req_id in payload", async () => {
    const response = await request(app)
      .post("/v1/requirements/bulk")
      .set(pmHeaders)
      .send({
        requirements: [baseRequirement, { ...baseRequirement }]
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "requirement_exists",
      duplicates: ["REQ-1"],
      message: "One or more requirements already exist"
    });
  });

  it("returns 404 when requirement is missing", async () => {
    const response = await request(app)
      .get("/v1/requirements/REQ-404")
      .set(pmHeaders);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "requirement_not_found" });
  });
});
