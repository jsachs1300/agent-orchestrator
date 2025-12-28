import type { Role } from "./state.js";

declare module "express-serve-static-core" {
  interface Request {
    agent?: {
      role: Role;
      id: string;
    };
  }
}

export {};
