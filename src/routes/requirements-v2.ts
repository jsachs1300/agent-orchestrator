import { Router } from "express";
import { bulkRequirementsSchema } from "../validators/requirements-v2.js";
import { RequirementV2 } from "../types/requirements-v2.js";
import {
  bulkCreateRequirements,
  getRequirement
} from "../store/requirements-store.js";
import { requireRole, requireV2Identity } from "../middleware/v2-auth.js";

const router = Router();

router.use(requireV2Identity);

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

  return res.status(200).json(requirement);
});

export default router;
