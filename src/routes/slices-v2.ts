import { Router } from "express";
import {
  bulkSlicesSchema,
  designPatchSchema,
  emptyBodySchema,
  implementationPatchSchema,
  nextSliceRoleSchema,
  testsPatchSchema
} from "../validators/slices-v2.js";
import { SliceV2 } from "../types/slices-v2.js";
import {
  bulkCreateSlices,
  getSlice,
  listSlicesInOrder,
  saveSlice
} from "../store/slices-store.js";
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
    claimed_by: null,
    claimed_at: null,
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

router.get("/v1/slices/next", async (req, res) => {
  const roleInput = typeof req.query.role === "string" ? req.query.role : "";
  const parsedRole = nextSliceRoleSchema.safeParse(roleInput);
  if (!parsedRole.success) {
    return res.status(400).json({ error: "invalid_role" });
  }

  const slices = await listSlicesInOrder();
  if (slices.length === 0) {
    return res.status(404).json({ error: "not_found" });
  }

  const sliceMap = new Map(slices.map((slice) => [slice.slice_id, slice]));
  const nextSlice = slices.find((slice) => {
    if (slice.owner_role !== parsedRole.data) {
      return false;
    }
    if (slice.claimed_by) {
      return false;
    }
    if (slice.status === "done") {
      return false;
    }
    if (slice.depends_on && slice.depends_on.length > 0) {
      const dependenciesReady = slice.depends_on.every((dependency) => {
        const dependencySlice = sliceMap.get(dependency);
        return dependencySlice?.status === "done";
      });
      if (!dependenciesReady) {
        return false;
      }
    }
    return true;
  });

  if (!nextSlice) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.status(200).json(nextSlice);
});

router.get("/v1/slices/:slice_id", async (req, res) => {
  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;

  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.status(200).json(slice);
});

router.post("/v1/slices/:slice_id/claim", async (req, res) => {
  const parsedBody = emptyBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;
  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  if (slice.claimed_by) {
    return res.status(409).json({ error: "already_claimed" });
  }

  if (slice.owner_role !== req.agent!.role) {
    return res.status(409).json({ error: "wrong_role" });
  }

  slice.claimed_by = { role: req.agent!.role, id: req.agent!.id };
  slice.claimed_at = new Date().toISOString();

  await saveSlice(slice);
  return res.status(200).json(slice);
});

router.post("/v1/slices/:slice_id/release", async (req, res) => {
  const parsedBody = emptyBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;
  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  if (!slice.claimed_by) {
    return res.status(409).json({ error: "not_claimed" });
  }

  if (slice.claimed_by.role !== req.agent!.role || slice.claimed_by.id !== req.agent!.id) {
    return res.status(409).json({ error: "not_claimer" });
  }

  slice.claimed_by = null;
  slice.claimed_at = null;

  await saveSlice(slice);
  return res.status(200).json(slice);
});

router.patch("/v1/slices/:slice_id/design", requireRole("architect"), async (req, res) => {
  const parsed = designPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;
  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  slice.deliverables.architect = {
    ...slice.deliverables.architect,
    design_spec: parsed.data.design_spec
  };

  if (parsed.data.evidence) {
    slice.evidence = [...slice.evidence, ...parsed.data.evidence];
  }

  await saveSlice(slice);
  return res.status(200).json(slice);
});

router.patch("/v1/slices/:slice_id/implementation", requireRole("coder"), async (req, res) => {
  const parsed = implementationPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;
  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  if (parsed.data.implementation_notes) {
    slice.deliverables.coder = {
      ...slice.deliverables.coder,
      implementation_notes: parsed.data.implementation_notes
    };
  }

  if (parsed.data.pr) {
    slice.deliverables.coder = {
      ...slice.deliverables.coder,
      pr: parsed.data.pr
    };
  }

  if (parsed.data.evidence) {
    slice.evidence = [...slice.evidence, ...parsed.data.evidence];
  }

  await saveSlice(slice);
  return res.status(200).json(slice);
});

router.patch("/v1/slices/:slice_id/tests", requireRole("tester"), async (req, res) => {
  const parsed = testsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const sliceId = String(req.params.slice_id || "").trim();
  const slice = sliceId ? await getSlice(sliceId) : null;
  if (!slice) {
    return res.status(404).json({ error: "not_found" });
  }

  if (parsed.data.test_plan) {
    slice.deliverables.tester = {
      ...slice.deliverables.tester,
      test_plan: parsed.data.test_plan
    };
  }

  if (parsed.data.test_results) {
    slice.deliverables.tester = {
      ...slice.deliverables.tester,
      test_results: parsed.data.test_results
    };
  }

  if (parsed.data.evidence) {
    slice.evidence = [...slice.evidence, ...parsed.data.evidence];
  }

  await saveSlice(slice);
  return res.status(200).json(slice);
});

export default router;
