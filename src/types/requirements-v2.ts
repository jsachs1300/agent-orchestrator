export type RequirementPriority = "P0" | "P1" | "P2" | "P3";

export type RequirementStatus =
  | "derived"
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed";

export interface RequirementV2 {
  req_id: string;
  title: string;
  priority: RequirementPriority;
  acceptance: string[];
  constraints: string[];
  source_ref: string;
  status: RequirementStatus;
}
