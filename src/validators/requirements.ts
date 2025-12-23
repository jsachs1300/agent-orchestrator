import { z } from "zod";

export const prioritySchema = z.object({
  tier: z.enum(["p0", "p1", "p2"]),
  rank: z.number().int().positive()
});

export const sectionStatusSchema = z.enum([
  "unaddressed",
  "in_progress",
  "complete",
  "blocked"
]);

export const overallStatusSchema = z.enum(["open", "ready_for_pm_review", "done", "blocked"]);

export const pmSchema = z
  .object({
    status: sectionStatusSchema,
    direction: z.string(),
    feedback: z.string(),
    decision: z.string()
  })
  .strict();

export const architectureSchema = z
  .object({
    status: sectionStatusSchema,
    design_spec: z.string()
  })
  .strict();

export const engineeringSchema = z
  .object({
    status: sectionStatusSchema,
    implementation_notes: z.string(),
    pr: z
    .object({
      number: z.number().int().nonnegative(),
      title: z.string(),
      url: z.string().url(),
      commit: z.string()
    })
    .nullable()
    .optional()
  })
  .strict();

export const qaSchema = z
  .object({
    status: sectionStatusSchema,
    test_plan: z.string(),
    test_cases: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        steps: z.string(),
        expected: z.string(),
        status: z.string(),
        notes: z.string()
      })
    )
    .optional()
    .default([]),
  test_results: z
    .object({
      status: z.string(),
      notes: z.string()
    })
    .optional()
    .default({ status: "", notes: "" })
  })
  .strict();

export const pmUpdateSchema = z
  .object({
    pm: pmSchema,
    priority: prioritySchema.optional()
  })
  .strict();

export const overallStatusUpdateSchema = z
  .object({
    status: overallStatusSchema
  })
  .strict();

export const architectureUpdateSchema = architectureSchema;
export const engineeringUpdateSchema = engineeringSchema;
export const qaUpdateSchema = qaSchema;
