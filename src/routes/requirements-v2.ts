import { Router } from "express";
import { bulkRequirementsSchema } from "../validators/requirements-v2.js";
import { RequirementV2 } from "../types/requirements-v2.js";
import {
  bulkCreateRequirements,
  getRequirement
} from "../store/requirements-store.js";
import { listSlicesByRequirement } from "../store/slices-store.js";
import { SliceStatus } from "../types/slices-v2.js";
import { requireRole, requireV2Identity } from "../middleware/v2-auth.js";

const router = Router();

router.use(requireV2Identity);

function deriveRequirementStatus(statuses: SliceStatus[]): RequirementV2["status"] {
  if (statuses.length === 0) {
    return "derived";
  }

  if (statuses.every((status) => status === "done")) {
    return "completed";
  }

  if (statuses.some((status) => status === "blocked")) {
    return "blocked";
  }

  if (statuses.some((status) => status === "in_progress" || status === "done")) {
    return "in_progress";
  }

  return "not_started";
}

router.post("/v1/requirements/bulk", requireRole("pm"), async (req, res) => {
  const parsed = bulkRequirementsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }

  const requirements: RequirementV2[] = parsed.data.requirements.map((item) => ({
    req_id: item.req_id,
    title: item.title,
    priority: item.priority,
    acceptance: item.acceptance,
    constraints: item.constraints,
    source_ref: item.source_ref,
    status: "derived"
  }));

  const result = await bulkCreateRequirements(requirements);
  if (!result.ok) {
    return res.status(409).json({
      error: "requirement_exists",
      duplicates: result.duplicates,
      message: "One or more requirements already exist"
    });
  }

  return res.status(201).json({ requirements });
});

router.get("/v1/requirements/:req_id", async (req, res) => {
  const reqId = String(req.params.req_id || "").trim();
  const requirement = reqId ? await getRequirement(reqId) : null;

  if (!requirement) {
    return res.status(404).json({ error: "requirement_not_found" });
  }

  const slices = await listSlicesByRequirement(reqId);
  const status = deriveRequirementStatus(slices.map((slice) => slice.status));

  return res.status(200).json({ ...requirement, status });
});

export default router;
