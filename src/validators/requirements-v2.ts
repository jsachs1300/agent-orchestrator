import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const prioritySchema = z.enum(["P0", "P1", "P2", "P3"]);

export const requirementSchema = z
  .object({
    req_id: nonEmptyString,
    title: nonEmptyString,
    priority: prioritySchema,
    acceptance: z.array(nonEmptyString),
    constraints: z.array(nonEmptyString),
    source_ref: nonEmptyString,
    status: z.literal("derived").optional()
  })
  .strict();

export const bulkRequirementsSchema = z
  .object({
    requirements: z.array(requirementSchema)
  })
  .strict();
