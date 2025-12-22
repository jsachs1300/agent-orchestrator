import { Router } from "express";
import { lintPlan, validatePlanShape } from "../plan/lint.js";

const router = Router();

router.post("/v1/plan/lint", (req, res) => {
  const { plan } = req.body ?? {};
  const shape = validatePlanShape(plan);

  if (!shape.plan) {
    return res.status(200).json({
      ok: false,
      errors: shape.findings,
      warnings: [],
      meta: {
        checked_at: new Date().toISOString(),
        requirements_found: 0
      }
    });
  }

  const { errors, warnings } = lintPlan(shape.plan);
  return res.status(200).json({
    ok: errors.length === 0,
    errors,
    warnings,
    meta: {
      checked_at: new Date().toISOString(),
      requirements_found: shape.plan.slices.length
    }
  });
});

export default router;
