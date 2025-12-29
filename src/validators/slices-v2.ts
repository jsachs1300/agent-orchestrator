import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const sliceOwnerRoleSchema = z.enum(["pm", "architect", "coder", "tester"]);

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
