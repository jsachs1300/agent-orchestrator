import { NextFunction, Request, Response } from "express";
import { Role } from "../types/state.js";

const allowedRoles: Role[] = ["pm", "architect", "coder", "tester", "system"];
const requiredRoleString = allowedRoles.join("|");

function unauthorized(
  res: Response,
  message: string,
  requiredRole: string,
  providedRole: string
) {
  return res.status(401).json({
    error: "unauthorized",
    message,
    required_role: requiredRole,
    provided_role: providedRole
  });
}

export function requireIdentity(req: Request, res: Response, next: NextFunction) {
  const roleHeader = req.header("x-agent-role");
  const agentId = req.header("x-agent-id");

  if (!roleHeader || !agentId) {
    return unauthorized(
      res,
      "missing required headers",
      requiredRoleString,
      roleHeader ? roleHeader.toLowerCase() : ""
    );
  }

  const normalizedRole = roleHeader.toLowerCase() as Role;
  if (!allowedRoles.includes(normalizedRole)) {
    return unauthorized(res, "invalid role", requiredRoleString, normalizedRole);
  }

  req.agent = { role: normalizedRole, id: agentId };
  return next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const provided = req.agent?.role ?? "";
    if (provided !== role) {
      return unauthorized(res, "role not permitted for this endpoint", role, provided);
    }
    return next();
  };
}
