import { Role } from "./state.js";

declare global {
  namespace Express {
    interface Request {
      agent?: {
        role: Role;
        id: string;
      };
    }
  }
}

export {};
