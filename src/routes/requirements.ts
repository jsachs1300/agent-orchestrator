import { Router, Response } from "express";
import { z } from "zod";
import {
  architectUpdateSchema,
  coderUpdateSchema,
  overallStatusUpdateSchema,
  pmUpdateSchema,
  prioritySchema,
  testerUpdateSchema
} from "../validators/requirements.js";
import { Requirement } from "../types/state.js";
import { requireRole } from "../middleware/auth.js";
import { getRequirement, listRequirements, listTopRequirements, saveRequirement } from "../redis.js";

const router = Router();

const requirementIdPattern = /^REQ-\d+$/;

function parseId(rawId: string): string {
  return rawId.trim().toUpperCase();
}

function isValidRequirementId(id: string): boolean {
  return requirementIdPattern.test(id);
}

function getRequirementOr404(requirement: Requirement | null, res: Response): Requirement | null {
  if (!requirement) {
    res.status(404).json({ error: "requirement_not_found" });
    return null;
  }
  return requirement;
}

function emptyRequirement(id: string, title: string, priority: Requirement["priority"]): Requirement {
  return {
    req_id: id,
    title,
    priority,
    overall_status: "not_started",
    sections: {
      pm: { status: "unaddressed", direction: "", feedback: "", decision: "pending" },
      architect: { status: "unaddressed", design_spec: "" },
      coder: { status: "unaddressed", implementation_notes: "", pr: null },
      tester: {
        status: "unaddressed",
        test_plan: "",
        test_cases: [],
        test_results: { status: "", notes: "" }
      }
    }
  };
}

function hasPriorityConflict(
  requirements: Record<string, Requirement>,
  id: string,
  tier: string,
  rank: number
): boolean {
  return Object.values(requirements).some(
    (requirement) =>
      requirement.req_id !== id &&
      requirement.priority.tier === tier &&
      requirement.priority.rank === rank
  );
}

const bulkSchema = z
  .object({
    requirements: z.array(
      z
        .object({
          req_id: z.string(),
          title: z.string(),
          priority: prioritySchema
        })
        .strict()
    )
  })
  .strict();

router.get("/v1/requirements", async (_req, res) => {
  const requirements = await listRequirements();
  return res.json({ requirements });
});

router.get("/v1/requirements/top", async (_req, res) => {
  const requirements = await listTopRequirements(1);
  return res.json({ requirements });
});

router.get("/v1/requirements/top/:n", async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.n);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_limit" });
  }

  const requirements = await listTopRequirements(parsed.data);
  return res.json({ requirements });
});

router.get("/v1/requirements/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const requirement = await getRequirement(id);
  const found = getRequirementOr404(requirement, res);
  if (!found) {
    return;
  }
  return res.json(found);
});

router.put("/v1/requirements/:id/pm", requireRole("pm"), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = pmUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const requirement = await getRequirement(id);
  const found = getRequirementOr404(requirement, res);
  if (!found) {
    return;
  }

  const requirements = await listRequirements();
  if (parsed.data.priority) {
    if (hasPriorityConflict(requirements, id, parsed.data.priority.tier, parsed.data.priority.rank)) {
      return res.status(400).json({
        error: "priority_conflict",
        message: "priority tier+rank must be unique"
      });
    }
    found.priority = parsed.data.priority;
  }

  found.sections.pm = parsed.data.section;

  await saveRequirement(found, req.agent!, "update_pm", requirement);
  return res.json(found);
});

router.put("/v1/requirements/:id/status", requireRole("pm"), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = overallStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const requirement = await getRequirement(id);
  const found = getRequirementOr404(requirement, res);
  if (!found) {
    return;
  }

  found.overall_status = parsed.data.overall_status;
  await saveRequirement(found, req.agent!, "update_overall_status", requirement);
  return res.json(found);
});

router.put(
  "/v1/requirements/:id/architecture",
  requireRole("architect"),
  async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = architectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const requirement = await getRequirement(id);
    const found = getRequirementOr404(requirement, res);
    if (!found) {
      return;
    }

    found.sections.architect = parsed.data.section;
    await saveRequirement(found, req.agent!, "update_architecture", requirement);
    return res.json(found);
  }
);

router.put("/v1/requirements/:id/engineering", requireRole("coder"), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = coderUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const requirement = await getRequirement(id);
  const found = getRequirementOr404(requirement, res);
  if (!found) {
    return;
  }

  found.sections.coder = parsed.data.section;
  await saveRequirement(found, req.agent!, "update_engineering", requirement);
  return res.json(found);
});

router.put("/v1/requirements/:id/qa", requireRole("tester"), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = testerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const requirement = await getRequirement(id);
  const found = getRequirementOr404(requirement, res);
  if (!found) {
    return;
  }

  found.sections.tester = parsed.data.section;
  await saveRequirement(found, req.agent!, "update_qa", requirement);
  return res.json(found);
});

router.post("/v1/requirements/bulk", requireRole("pm"), async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const requirements = await listRequirements();
  const seenIds = new Set<string>();
  const seenPriorities = new Set<string>();

  for (const entry of parsed.data.requirements) {
    const normalizedId = parseId(entry.req_id);
    if (!isValidRequirementId(normalizedId)) {
      return res.status(400).json({
        error: "invalid_requirement_id",
        message: `invalid requirement id: ${entry.req_id}`
      });
    }

    if (seenIds.has(normalizedId)) {
      return res.status(400).json({
        error: "duplicate_requirement_id",
        message: `duplicate requirement id: ${normalizedId}`
      });
    }
    seenIds.add(normalizedId);

    const priorityKey = `${entry.priority.tier}:${entry.priority.rank}`;
    if (seenPriorities.has(priorityKey)) {
      return res.status(400).json({
        error: "priority_conflict",
        message: "priority tier+rank must be unique"
      });
    }
    seenPriorities.add(priorityKey);

    if (hasPriorityConflict(requirements, normalizedId, entry.priority.tier, entry.priority.rank)) {
      return res.status(400).json({
        error: "priority_conflict",
        message: "priority tier+rank must be unique"
      });
    }

    const existing = requirements[normalizedId];
    if (existing) {
      existing.title = entry.title;
      existing.priority = entry.priority;
      await saveRequirement(existing, req.agent!, "bulk_update", existing);
      continue;
    }

    const created = emptyRequirement(normalizedId, entry.title, entry.priority);
    await saveRequirement(created, req.agent!, "bulk_create", null);
    requirements[normalizedId] = created;
  }

  return res.json({ requirements });
});

export default router;
