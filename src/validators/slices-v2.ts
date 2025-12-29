import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const sliceOwnerRoleSchema = z.enum(["pm", "architect", "coder", "tester"]);

export const evidenceSchema = z
  .object({
    type: z.enum(["file", "command", "test", "pr"]),
    ref: nonEmptyString,
    result: z.enum(["pass", "fail"]).nullable().optional()
  })
  .strict();

export const sliceInputSchema = z
  .object({
    slice_id: nonEmptyString,
    req_id: nonEmptyString,
    title: nonEmptyString,
    owner_role: sliceOwnerRoleSchema,
    depends_on: z.array(nonEmptyString).optional()
  })
  .strict();

export const bulkSlicesSchema = z
  .object({
    slices: z.array(sliceInputSchema)
  })
  .strict();

export const designPatchSchema = z
  .object({
    design_spec: nonEmptyString,
    evidence: z.array(evidenceSchema).optional()
  })
  .strict();

export const implementationPatchSchema = z
  .object({
    implementation_notes: nonEmptyString.optional(),
    pr: nonEmptyString.optional(),
    evidence: z.array(evidenceSchema).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.implementation_notes && !value.pr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "implementation_notes or pr is required"
      });
    }
  });

export const testResultsSchema = z
  .object({
    status: nonEmptyString,
    notes: nonEmptyString.optional()
  })
  .strict();

export const testsPatchSchema = z
  .object({
    test_plan: nonEmptyString.optional(),
    test_results: testResultsSchema.optional(),
    evidence: z.array(evidenceSchema).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.test_plan && !value.test_results) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "test_plan or test_results is required"
      });
    }
  });
