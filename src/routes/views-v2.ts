import { Router } from "express";
import { requireV2Identity } from "../middleware/v2-auth.js";
import { getSlice } from "../store/slices-store.js";
import { SliceOwnerRole } from "../types/slices-v2.js";
import { buildSliceView } from "../views/slice-view.js";

const router = Router();

router.use(requireV2Identity);

router.get("/v1/views/slice/:slice_id", async (req, res) => {
  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;

  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  const role = req.agent!.role as SliceOwnerRole;
  return res.status(200).json(buildSliceView(slice, role));
});

export default router;
