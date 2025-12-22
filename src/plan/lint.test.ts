import { describe, expect, it } from "vitest";
import { lintPlan, validatePlanShape } from "./lint.js";
import { Plan } from "../types/plan.js";

const basePlan: Plan = {
  version: "1.0",
  slices: [
    {
      id: "REQ-1",
      title: "First slice",
      priority: { tier: "p0", rank: 1 },
      direction: "Build the first slice",
      acceptance_criteria: ["a", "b", "c"],
      out_of_scope: ["none"],
      dependencies: []
    },
    {
      id: "REQ-2",
      title: "Second slice",
      priority: { tier: "p1", rank: 1 },
      direction: "Build the second slice",
      acceptance_criteria: ["a", "b", "c"],
      out_of_scope: ["none"],
      dependencies: ["REQ-1"]
    }
  ]
};

function clonePlan(): Plan {
  return JSON.parse(JSON.stringify(basePlan)) as Plan;
}

describe("validatePlanShape", () => {
  it("accepts a valid plan shape", () => {
    const result = validatePlanShape(basePlan);
    expect(result.findings).toHaveLength(0);
    expect(result.plan?.version).toBe("1.0");
  });
});

describe("lintPlan", () => {
  it("returns ok for a valid plan", () => {
    const { errors, warnings } = lintPlan(basePlan);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("flags duplicate tier+rank", () => {
    const plan = clonePlan();
    plan.slices[1].priority = { tier: "p0", rank: 1 };
    const { errors } = lintPlan(plan);
    expect(errors.some((finding) => finding.code === "P-011")).toBe(true);
  });

  it("flags missing acceptance criteria", () => {
    const plan = clonePlan();
    plan.slices[0].acceptance_criteria = ["a"];
    const { errors } = lintPlan(plan);
    expect(errors.some((finding) => finding.code === "P-007")).toBe(true);
  });

  it("flags bad id format", () => {
    const plan = clonePlan();
    plan.slices[0].id = "REQ-ABC";
    const { errors } = lintPlan(plan);
    expect(errors.some((finding) => finding.code === "P-003")).toBe(true);
  });

  it("warns on unknown dependency", () => {
    const plan = clonePlan();
    plan.slices[1].dependencies = ["REQ-999"];
    const { warnings } = lintPlan(plan);
    expect(warnings.some((finding) => finding.code === "P-012")).toBe(true);
  });

  it("warns when slices are unsorted", () => {
    const plan = clonePlan();
    plan.slices = [plan.slices[1], plan.slices[0]];
    const { warnings } = lintPlan(plan);
    expect(warnings.some((finding) => finding.code === "P-013")).toBe(true);
  });
});
