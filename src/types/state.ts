export type Role = "pm" | "architect" | "coder" | "tester" | "system";

export interface Priority {
  tier: string;
  rank: number;
}

export interface RequirementPm {
  status: "unaddressed" | "in_progress" | "complete" | "blocked" | string;
  direction: string;
  feedback: string;
  decision: "pending" | "approved" | "rejected" | string;
}

export interface RequirementArchitecture {
  status: "unaddressed" | "in_progress" | "complete" | "blocked" | string;
  design_spec: string;
}

export interface RequirementEngineering {
  status: "unaddressed" | "in_progress" | "complete" | "blocked" | string;
  implementation_notes: string;
  pr?: {
    number: number;
    title: string;
    url: string;
    commit: string;
  } | null;
}

export interface RequirementQa {
  status: "unaddressed" | "in_progress" | "complete" | "blocked" | string;
  test_plan: string;
  test_cases: Array<{
    id: string;
    title: string;
    steps: string;
    expected: string;
    status: string;
    notes: string;
  }>;
  test_results: {
    status: string;
    notes: string;
  };
}

export interface Requirement {
  id: string;
  title: string;
  priority: Priority;
  status: "open" | "ready_for_pm_review" | "done" | "blocked" | string;
  pm: RequirementPm;
  architecture: RequirementArchitecture;
  engineering: RequirementEngineering;
  qa: RequirementQa;
}

export interface State {
  schema_version: "1.0";
  updated_at: string;
  requirements: Record<string, Requirement>;
}
