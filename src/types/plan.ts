export interface Plan {
  version: "1.0" | string;
  slices: Slice[];
}

export interface Slice {
  id: string;
  title: string;
  priority: {
    tier: "p0" | "p1" | "p2" | string;
    rank: number;
  };
  direction: string;
  acceptance_criteria: string[];
  out_of_scope: string[];
  dependencies: string[];
  notes?: string;
}

export interface LintFinding {
  severity: "error" | "warn";
  code: string;
  message: string;
  req_id?: string;
  path?: string;
}
