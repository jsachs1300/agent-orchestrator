import { z } from "zod";
import { LintFinding, Plan } from "../types/plan.js";

const sliceSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.object({
    tier: z.string(),
    rank: z.number()
  }),
  direction: z.string(),
  acceptance_criteria: z.array(z.string()),
  out_of_scope: z.array(z.string()),
  dependencies: z.array(z.string()),
  notes: z.string().optional()
});

const planSchema = z.object({
  version: z.string(),
  slices: z.array(sliceSchema)
});

function formatPath(base: string, path: Array<string | number>): string {
  const suffix = path
    .map((segment) => String(segment))
    .filter((segment) => segment.length > 0)
    .join("/");
  return suffix.length > 0 ? `${base}/${suffix}` : base;
}

function shapeFinding(message: string, path: Array<string | number>): LintFinding {
  return {
    severity: "error",
    code: "P-SHAPE",
    message,
    path: formatPath("/plan", path)
  };
}

export function validatePlanShape(input: unknown): { plan?: Plan; findings: LintFinding[] } {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    const findings = parsed.error.issues.map((issue) =>
      shapeFinding(issue.message, issue.path)
    );
    return { findings };
  }

  return { plan: parsed.data, findings: [] };
}

function errorFinding(
  code: string,
  message: string,
  path: string,
  reqId?: string
): LintFinding {
  return { severity: "error", code, message, path, req_id: reqId };
}

function warnFinding(
  code: string,
  message: string,
  path: string,
  reqId?: string
): LintFinding {
  return { severity: "warn", code, message, path, req_id: reqId };
}

const tierOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2 };

export function lintPlan(plan: Plan): { errors: LintFinding[]; warnings: LintFinding[] } {
  const errors: LintFinding[] = [];
  const warnings: LintFinding[] = [];

  if (plan.version !== "1.0") {
    errors.push(
      errorFinding("P-001", "plan.version must equal \"1.0\"", "/plan/version")
    );
  }

  if (!Array.isArray(plan.slices) || plan.slices.length === 0) {
    errors.push(
      errorFinding("P-002", "plan.slices must have at least one entry", "/plan/slices")
    );
    return { errors, warnings };
  }

  const seenIds = new Set<string>();
  const seenPriority = new Set<string>();
  const allIds = new Set<string>();

  plan.slices.forEach((slice, index) => {
    const basePath = `/plan/slices/${index}`;

    if (!/^REQ-\d+$/.test(slice.id)) {
      errors.push(
        errorFinding("P-003", "slice.id must match REQ-n", `${basePath}/id`, slice.id)
      );
    }

    if (seenIds.has(slice.id)) {
      errors.push(
        errorFinding("P-004", "slice.id must be unique", `${basePath}/id`, slice.id)
      );
    }
    seenIds.add(slice.id);
    allIds.add(slice.id);

    if (!slice.title.trim()) {
      errors.push(
        errorFinding("P-005", "slice.title must be non-empty", `${basePath}/title`, slice.id)
      );
    }

    if (!slice.direction.trim()) {
      errors.push(
        errorFinding(
          "P-006",
          "slice.direction must be non-empty",
          `${basePath}/direction`,
          slice.id
        )
      );
    }

    const criteria = slice.acceptance_criteria || [];
    const nonEmptyCriteria = criteria.filter((entry) => entry.trim().length > 0);
    if (nonEmptyCriteria.length < 3) {
      errors.push(
        errorFinding(
          "P-007",
          "acceptance_criteria must include at least 3 non-empty entries",
          `${basePath}/acceptance_criteria`,
          slice.id
        )
      );
    }

    const outOfScope = slice.out_of_scope || [];
    const hasNoneOnly =
      outOfScope.length === 1 && outOfScope[0].trim().toLowerCase() === "none";
    const nonEmptyOutOfScope = outOfScope.filter((entry) => entry.trim().length > 0);
    const containsNone = outOfScope.some((entry) => entry.trim().toLowerCase() === "none");
    if (outOfScope.length === 0 || nonEmptyOutOfScope.length === 0 || (containsNone && !hasNoneOnly)) {
      errors.push(
        errorFinding(
          "P-008",
          "out_of_scope must be [\"none\"] or a list of non-empty strings",
          `${basePath}/out_of_scope`,
          slice.id
        )
      );
    }

    if (!(slice.priority.tier in tierOrder)) {
      errors.push(
        errorFinding(
          "P-009",
          "priority.tier must be one of p0, p1, p2",
          `${basePath}/priority/tier`,
          slice.id
        )
      );
    }

    if (!Number.isInteger(slice.priority.rank) || slice.priority.rank <= 0) {
      errors.push(
        errorFinding(
          "P-010",
          "priority.rank must be a positive integer",
          `${basePath}/priority/rank`,
          slice.id
        )
      );
    }

    const priorityKey = `${slice.priority.tier}:${slice.priority.rank}`;
    if (seenPriority.has(priorityKey)) {
      errors.push(
        errorFinding(
          "P-011",
          "priority tier+rank pair must be unique",
          `${basePath}/priority`,
          slice.id
        )
      );
    }
    seenPriority.add(priorityKey);
  });

  plan.slices.forEach((slice, index) => {
    const basePath = `/plan/slices/${index}/dependencies`;
    slice.dependencies.forEach((dep, depIndex) => {
      if (!allIds.has(dep)) {
        warnings.push(
          warnFinding(
            "P-012",
            "dependency should reference an existing slice id",
            `${basePath}/${depIndex}`,
            slice.id
          )
        );
      }
    });
  });

  const sorted = [...plan.slices].sort((a, b) => {
    const tierDiff = (tierOrder[a.priority.tier] ?? 99) - (tierOrder[b.priority.tier] ?? 99);
    if (tierDiff !== 0) {
      return tierDiff;
    }
    return a.priority.rank - b.priority.rank;
  });

  const isSorted = plan.slices.every((slice, index) => slice === sorted[index]);
  if (!isSorted) {
    warnings.push(
      warnFinding(
        "P-013",
        "slices should be ordered by priority tier then rank",
        "/plan/slices"
      )
    );
  }

  return { errors, warnings };
}
