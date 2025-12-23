export type Role = "pm" | "architect" | "coder" | "tester" | "system";

export interface Priority {
  tier: string;
  rank: number;
}

export type SectionStatus = "unaddressed" | "in_progress" | "complete" | "blocked" | string;
export type OverallStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "completed"
  | string;

export interface PmSection {
  status: SectionStatus;
  direction: string;
  feedback: string;
  decision: "pending" | "approved" | "rejected" | string;
}

export interface ArchitectSection {
  status: SectionStatus;
  design_spec: string;
}

export interface CoderSection {
  status: SectionStatus;
  implementation_notes: string;
  pr?: {
    number: number;
    title: string;
    url: string;
    commit: string;
  } | null;
}

export interface TesterSection {
  status: SectionStatus;
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

export interface RequirementSections {
  pm: PmSection;
  architect: ArchitectSection;
  coder: CoderSection;
  tester: TesterSection;
}

export interface Requirement {
  req_id: string;
  title: string;
  priority: Priority;
  overall_status: OverallStatus;
  sections: RequirementSections;
}

export interface State {
  schema_version: "1.0";
  updated_at: string;
  requirements: Record<string, Requirement>;
}
