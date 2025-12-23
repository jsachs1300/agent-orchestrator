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

export const overallStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "in_review",
  "completed"
]);

export const pmSectionSchema = z
  .object({
    status: sectionStatusSchema,
    direction: z.string(),
    feedback: z.string(),
    decision: z.string()
  })
  .strict();

export const architectSectionSchema = z
  .object({
    status: sectionStatusSchema,
    design_spec: z.string()
  })
  .strict();

export const coderSectionSchema = z
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

export const testerSectionSchema = z
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
    section: pmSectionSchema,
    priority: prioritySchema.optional()
  })
  .strict();

export const overallStatusUpdateSchema = z
  .object({
    overall_status: overallStatusSchema
  })
  .strict();

export const architectUpdateSchema = z
  .object({
    section: architectSectionSchema
  })
  .strict();

export const coderUpdateSchema = z
  .object({
    section: coderSectionSchema
  })
  .strict();

export const testerUpdateSchema = z
  .object({
    section: testerSectionSchema
  })
  .strict();
