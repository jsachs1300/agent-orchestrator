import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import { clearSlicesStore, getSlice, saveSlice } from "../store/slices-store.js";

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
  claimed_by: null,
  claimed_at: null,
  deliverables: {
    architect: { design_spec: null },
    coder: { implementation_notes: null, pr: null },
    tester: { test_plan: null, test_results: null }
  },
  evidence: []
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
    expect(firstResponse.body.evidence).toHaveLength(1);

    const secondResponse = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({
        design_spec: "Spec v2",
        evidence: [{ type: "command", ref: "make docs" }]
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.evidence).toHaveLength(2);
  });

  it("stores evidence at the slice level", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/implementation")
      .set(coderHeaders)
      .send({
        implementation_notes: "Notes",
        evidence: [{ type: "pr", ref: "PR-123" }]
      });

    expect(response.status).toBe(200);
    expect(response.body.evidence).toHaveLength(1);
    expect(response.body.evidence[0]).toMatchObject({ type: "pr", ref: "PR-123" });
  });

  it("records evidence entries without author fields", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/tests")
      .set(testerHeaders)
      .send({
        test_plan: "Plan",
        evidence: [{ type: "test", ref: "Suite" }]
      });

    expect(response.status).toBe(200);
    expect(response.body.evidence).toHaveLength(1);
    expect(response.body.evidence[0]).toMatchObject({
      type: "test",
      ref: "Suite"
    });
    expect("author" in response.body.evidence[0]).toBe(false);
    expect("result" in response.body.evidence[0]).toBe(false);
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

  it("rejects status fields across patch endpoints", async () => {
    await createSlice();

    const responses = await Promise.all([
      request(app)
        .patch("/v1/slices/SLICE-1/implementation")
        .set(coderHeaders)
        .send({ implementation_notes: "Notes", status: "in_progress" }),
      request(app)
        .patch("/v1/slices/SLICE-1/tests")
        .set(testerHeaders)
        .send({ test_plan: "Plan", status: "in_progress" })
    ]);

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_body" });
    }
  });

  it("keeps slice status unchanged after successful patch", async () => {
    await createSlice();

    const response = await request(app)
      .patch("/v1/slices/SLICE-1/design")
      .set(architectHeaders)
      .send({ design_spec: "Spec" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("not_started");
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

  it("returns 401 when headers are missing on claim", async () => {
    const response = await request(app).post("/v1/slices/SLICE-1/claim");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("rejects claim and release bodies with fields", async () => {
    await createSlice();

    const claimResponse = await request(app)
      .post("/v1/slices/SLICE-1/claim")
      .set(architectHeaders)
      .send({ extra: "nope" });

    expect(claimResponse.status).toBe(400);
    expect(claimResponse.body).toEqual({ error: "invalid_body" });

    const releaseResponse = await request(app)
      .post("/v1/slices/SLICE-1/release")
      .set(architectHeaders)
      .send({ extra: "nope" });

    expect(releaseResponse.status).toBe(400);
    expect(releaseResponse.body).toEqual({ error: "invalid_body" });
  });

  it("rejects claim when role does not match owner_role", async () => {
    await createSlice();

    const claimResponse = await request(app)
      .post("/v1/slices/SLICE-1/claim")
      .set(coderHeaders);

    expect(claimResponse.status).toBe(409);
    expect(claimResponse.body).toEqual({ error: "wrong_role" });
  });

  it("claims a slice and prevents duplicate claims", async () => {
    await createSlice();

    const claimResponse = await request(app)
      .post("/v1/slices/SLICE-1/claim")
      .set(architectHeaders);

    expect(claimResponse.status).toBe(200);
    expect(claimResponse.body.claimed_by).toEqual({ role: "architect", id: "agent-3" });
    expect(claimResponse.body.claimed_at).toEqual(expect.any(String));

    const secondClaim = await request(app)
      .post("/v1/slices/SLICE-1/claim")
      .set(testerHeaders);

    expect(secondClaim.status).toBe(409);
    expect(secondClaim.body).toEqual({ error: "already_claimed" });
  });

  it("rejects release when not claimed or by non-claimer", async () => {
    await createSlice();

    const notClaimedResponse = await request(app)
      .post("/v1/slices/SLICE-1/release")
      .set(architectHeaders);

    expect(notClaimedResponse.status).toBe(409);
    expect(notClaimedResponse.body).toEqual({ error: "not_claimed" });

    await request(app).post("/v1/slices/SLICE-1/claim").set(architectHeaders);

    const wrongClaimerResponse = await request(app)
      .post("/v1/slices/SLICE-1/release")
      .set(testerHeaders);

    expect(wrongClaimerResponse.status).toBe(409);
    expect(wrongClaimerResponse.body).toEqual({ error: "not_claimer" });
  });

  it("releases a claimed slice", async () => {
    await createSlice();

    await request(app).post("/v1/slices/SLICE-1/claim").set(architectHeaders);

    const releaseResponse = await request(app)
      .post("/v1/slices/SLICE-1/release")
      .set(architectHeaders);

    expect(releaseResponse.status).toBe(200);
    expect(releaseResponse.body.claimed_by).toBeNull();
    expect(releaseResponse.body.claimed_at).toBeNull();
  });

  it("returns 400 for invalid next role", async () => {
    const response = await request(app)
      .get("/v1/slices/next")
      .set(pmHeaders)
      .query({ role: "pm" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_role" });
  });

  it("returns first eligible slice by insertion order", async () => {
    const slices = [
      { ...baseSlice, slice_id: "SLICE-1", owner_role: "coder" },
      { ...baseSlice, slice_id: "SLICE-2", owner_role: "coder" }
    ];

    await request(app).post("/v1/slices/bulk").set(pmHeaders).send({ slices });

    const response = await request(app)
      .get("/v1/slices/next")
      .set(coderHeaders)
      .query({ role: "coder" });

    expect(response.status).toBe(200);
    expect(response.body.slice_id).toBe("SLICE-1");
  });

  it("respects dependencies when selecting next slice", async () => {
    const slices = [
      { ...baseSlice, slice_id: "SLICE-1", owner_role: "coder" },
      { ...baseSlice, slice_id: "SLICE-2", owner_role: "coder", depends_on: ["SLICE-1"] }
    ];

    await request(app).post("/v1/slices/bulk").set(pmHeaders).send({ slices });

    const firstResponse = await request(app)
      .get("/v1/slices/next")
      .set(coderHeaders)
      .query({ role: "coder" });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.slice_id).toBe("SLICE-1");

    const slice = await getSlice("SLICE-1");
    if (!slice) {
      throw new Error("missing slice");
    }
    slice.status = "done";
    await saveSlice(slice);

    const secondResponse = await request(app)
      .get("/v1/slices/next")
      .set(coderHeaders)
      .query({ role: "coder" });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.slice_id).toBe("SLICE-2");
  });

  it("skips claimed slices when selecting next", async () => {
    const slices = [
      { ...baseSlice, slice_id: "SLICE-1", owner_role: "coder" },
      { ...baseSlice, slice_id: "SLICE-2", owner_role: "coder" }
    ];

    await request(app).post("/v1/slices/bulk").set(pmHeaders).send({ slices });
    await request(app).post("/v1/slices/SLICE-1/claim").set(coderHeaders);

    const response = await request(app)
      .get("/v1/slices/next")
      .set(coderHeaders)
      .query({ role: "coder" });

    expect(response.status).toBe(200);
    expect(response.body.slice_id).toBe("SLICE-2");
  });

  it("returns 404 when no eligible slices exist", async () => {
    const slices = [
      { ...baseSlice, slice_id: "SLICE-1", owner_role: "coder" },
      { ...baseSlice, slice_id: "SLICE-2", owner_role: "coder" }
    ];

    await request(app).post("/v1/slices/bulk").set(pmHeaders).send({ slices });

    const firstSlice = await getSlice("SLICE-1");
    const secondSlice = await getSlice("SLICE-2");
    if (!firstSlice || !secondSlice) {
      throw new Error("missing slices");
    }
    firstSlice.status = "done";
    secondSlice.status = "done";
    await saveSlice(firstSlice);
    await saveSlice(secondSlice);

    const response = await request(app)
      .get("/v1/slices/next")
      .set(coderHeaders)
      .query({ role: "coder" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });
});
