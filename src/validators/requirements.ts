import { z } from "zod";

export const prioritySchema = z.object({
  tier: z.string(),
  rank: z.number().int().nonnegative()
});

export const pmSchema = z.object({
  direction: z.string(),
  feedback: z.string(),
  decision: z.string()
});

export const architectureSchema = z.object({
  design_spec: z.string()
});

export const engineeringSchema = z.object({
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
});

export const qaSchema = z.object({
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
});

export const pmUpdateSchema = z.object({
  pm: pmSchema,
  priority: prioritySchema.optional(),
  status: z.string().optional()
});

export const pmDecisionSchema = z.object({
  decision: z.string()
});

export const architectureUpdateSchema = architectureSchema;
export const engineeringUpdateSchema = engineeringSchema;
export const qaUpdateSchema = qaSchema;
