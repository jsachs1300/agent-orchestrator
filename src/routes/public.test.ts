import { describe, expect, it } from "vitest";
import request from "supertest";

const { default: app } = await import("../app.js");

describe("public endpoints", () => {
  it("serves health without headers", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("serves prompt content without headers", async () => {
    const response = await request(app).get("/prompt/pm_system_prompt");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Product Manager (PM) Agent");
  });

  it("serves orchestration spec without headers", async () => {
    const response = await request(app).get("/ORCHESTRATION_SPEC.md");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Orchestration Spec (v1)");
  });
});
