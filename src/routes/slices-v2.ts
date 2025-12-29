import { Router } from "express";
import { bulkSlicesSchema } from "../validators/slices-v2.js";
import { SliceV2 } from "../types/slices-v2.js";
import { bulkCreateSlices, getSlice } from "../store/slices-store.js";
import { requireRole, requireV2Identity } from "../middleware/v2-auth.js";

const router = Router();

router.use(requireV2Identity);

router.post("/v1/slices/bulk", requireRole("pm"), async (req, res) => {
  const parsed = bulkSlicesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const slices: SliceV2[] = parsed.data.slices.map((item) => ({
    slice_id: item.slice_id,
    req_id: item.req_id,
    title: item.title,
    owner_role: item.owner_role,
    status: "not_started",
    depends_on: item.depends_on,
    deliverables: {
      architect: { design_spec: null },
      coder: { implementation_notes: null, pr: null },
      tester: { test_plan: null, test_results: null }
    },
    evidence: []
  }));

  const result = await bulkCreateSlices(slices);
  if (!result.ok) {
    return res.status(409).json({
      error: "slice_exists",
      duplicates: result.duplicates
    });
  }

  return res.status(201).json({ slices });
});

router.get("/v1/slices/:slice_id", async (req, res) => {
  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;

  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.status(200).json(slice);
});

export default router;
