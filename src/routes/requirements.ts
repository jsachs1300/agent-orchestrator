import { Router, Request, Response } from "express";
import { z } from "zod";
import { getState, setState } from "../redis.js";
import {
  architectureUpdateSchema,
  engineeringUpdateSchema,
  pmDecisionSchema,
  pmUpdateSchema,
  qaUpdateSchema
} from "../validators/requirements.js";
import { Requirement, State, Role } from "../types/state.js";
import { readFile } from "fs/promises";
import path from "path";

const router = Router();

const roleHeader = "x-agent-role";

function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: () => void) => {
    const roleValue = String(req.header(roleHeader) || "").toLowerCase() as Role;
    if (!roleValue || !roles.includes(roleValue)) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}

function getRequirementOr404(state: State, id: string, res: Response): Requirement | null {
  const requirement = state.requirements[id];
  if (!requirement) {
    res.status(404).json({ error: "requirement_not_found" });
    return null;
  }
  return requirement;
}

function parseId(rawId: string): string {
  return rawId.trim().toUpperCase();
}

function emptyRequirement(id: string, title: string): Requirement {
  return {
    id,
    title,
    priority: { tier: "", rank: 0 },
    status: "future",
    pm: { direction: "", feedback: "", decision: "pending" },
    architecture: { design_spec: "" },
    engineering: { implementation_notes: "", pr: null },
    qa: { test_plan: "", test_cases: [], test_results: { status: "", notes: "" } }
  };
}

const requirementLineSchema = z.object({
  id: z.string().min(1),
  title: z.string()
});

function parseRequirementsFromText(contents: string): Array<{ id: string; title: string }> {
  const lines = contents.split(/\r?\n/);
  const results: Array<{ id: string; title: string }> = [];

  const regex = /^\s*(?:[-*]\s*)?(?:#+\s*)?(REQ-\d+)\s*(?:[:\-–]\s*)?(.*)$/i;

  for (const line of lines) {
    const match = line.match(regex);
    if (!match) {
      continue;
    }

    const id = parseId(match[1]);
    const title = match[2].trim() || id;
    const parsed = requirementLineSchema.safeParse({ id, title });
    if (!parsed.success) {
      continue;
    }

    results.push({ id, title });
  }

  return results;
}

router.get("/v1/requirements", async (_req, res) => {
  const state = await getState();
  return res.json({ requirements: state.requirements });
});

router.get("/v1/requirements/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const state = await getState();
  const requirement = getRequirementOr404(state, id, res);
  if (!requirement) {
    return;
  }
  return res.json(requirement);
});

router.put("/v1/requirements/:id/pm", requireRole(["pm"]), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = pmUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const state = await getState();
  const requirement = getRequirementOr404(state, id, res);
  if (!requirement) {
    return;
  }

  requirement.pm = parsed.data.pm;
  if (parsed.data.priority) {
    requirement.priority = parsed.data.priority;
  }
  if (parsed.data.status) {
    requirement.status = parsed.data.status;
  }

  await setState(state);
  return res.json(requirement);
});

router.put("/v1/requirements/:id/pm-decision", requireRole(["pm"]), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = pmDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const state = await getState();
  const requirement = getRequirementOr404(state, id, res);
  if (!requirement) {
    return;
  }

  requirement.pm.decision = parsed.data.decision;
  await setState(state);
  return res.json(requirement);
});

router.put(
  "/v1/requirements/:id/architecture",
  requireRole(["architect"]),
  async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = architectureUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const state = await getState();
    const requirement = getRequirementOr404(state, id, res);
    if (!requirement) {
      return;
    }

    requirement.architecture = parsed.data;
    await setState(state);
    return res.json(requirement);
  }
);

router.put("/v1/requirements/:id/engineering", requireRole(["coder"]), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = engineeringUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const state = await getState();
  const requirement = getRequirementOr404(state, id, res);
  if (!requirement) {
    return;
  }

  requirement.engineering = parsed.data;
  await setState(state);
  return res.json(requirement);
});

router.put("/v1/requirements/:id/qa", requireRole(["tester"]), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = qaUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const state = await getState();
  const requirement = getRequirementOr404(state, id, res);
  if (!requirement) {
    return;
  }

  const qa = {
    test_plan: parsed.data.test_plan,
    test_cases: parsed.data.test_cases,
    test_results: parsed.data.test_results
  };

  requirement.qa = qa;
  await setState(state);
  return res.json(requirement);
});

router.post("/v1/requirements/sync", requireRole(["system"]), async (_req, res) => {
  const filePath = path.join(process.cwd(), "REQUIREMENTS.md");

  let contents = "";
  try {
    contents = await readFile(filePath, "utf-8");
  } catch (err: any) {
    return res.status(400).json({ error: "requirements_file_missing" });
  }

  const parsedRequirements = parseRequirementsFromText(contents);
  if (parsedRequirements.length === 0) {
    return res.status(400).json({ error: "no_requirements_found" });
  }

  const state = await getState();

  for (const entry of parsedRequirements) {
    const existing = state.requirements[entry.id];
    if (existing) {
      existing.title = entry.title;
      continue;
    }

    state.requirements[entry.id] = emptyRequirement(entry.id, entry.title);
  }

  await setState(state);
  return res.json({ requirements: state.requirements });
});

export default router;
