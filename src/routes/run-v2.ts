import { Router } from "express";
import { requireV2Identity } from "../middleware/v2-auth.js";
import { findNextSlice } from "../store/next-slice.js";
import { SliceOwnerRole } from "../types/slices-v2.js";
import { nextSliceRoleSchema } from "../validators/slices-v2.js";
import { buildSliceView } from "../views/slice-view.js";

const router = Router();

router.use(requireV2Identity);

router.get("/v1/run/next", async (req, res) => {
  const roleInput = typeof req.query.role === "string" ? req.query.role : "";
  const parsedRole = nextSliceRoleSchema.safeParse(roleInput);
  if (!parsedRole.success) {
    return res.status(400).json({ error: "invalid_role" });
  }

  const nextSlice = await findNextSlice(parsedRole.data);
  if (!nextSlice) {
    return res.status(404).json({ error: "not_found" });
  }

  const callerRole = req.agent!.role as SliceOwnerRole;
  return res.status(200).json({
    slice_id: nextSlice.slice_id,
    view: buildSliceView(nextSlice, callerRole)
  });
});

export default router;
