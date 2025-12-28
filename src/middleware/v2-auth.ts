import { NextFunction, Request, Response } from "express";
import { Role } from "../types/state.js";

const allowedRoles: Role[] = ["pm", "architect", "coder", "tester"];

function unauthorized(res: Response) {
  return res.status(401).json({ error: "unauthorized" });
}

export function requireV2Identity(req: Request, res: Response, next: NextFunction) {
  const roleHeader = req.header("x-agent-role");
  const agentId = req.header("x-agent-id");

  if (!roleHeader || !agentId || agentId.trim().length === 0) {
    return unauthorized(res);
  }

  const normalizedRole = roleHeader.toLowerCase() as Role;
  if (!allowedRoles.includes(normalizedRole)) {
    return unauthorized(res);
  }

  req.agent = { role: normalizedRole, id: agentId };
  return next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const provided = req.agent?.role;
    if (provided !== role) {
      return unauthorized(res);
    }
    return next();
  };
}
