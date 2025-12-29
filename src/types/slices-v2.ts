export type SliceOwnerRole = "pm" | "architect" | "coder" | "tester";
export type NextSliceRole = Exclude<SliceOwnerRole, "pm">;

export type SliceStatus = "not_started" | "in_progress" | "done" | "blocked";

export type EvidenceType = "file" | "command" | "test" | "pr";
export type EvidenceResult = "pass" | "fail";

export interface EvidenceAuthor {
  role: SliceOwnerRole;
  id: string;
}

export interface EvidenceInput {
  type: EvidenceType;
  ref: string;
  result?: EvidenceResult | null;
}

export interface SliceDeliverables {
  architect: { design_spec: string | null };
  coder: { implementation_notes: string | null; pr: string | null };
  tester: {
    test_plan: string | null;
    test_results: { status: string; notes?: string } | null;
  };
}

export type Evidence = EvidenceInput;

export interface SliceV2 {
  slice_id: string;
  req_id: string;
  title: string;
  owner_role: SliceOwnerRole;
  status: SliceStatus;
  claimed_by: EvidenceAuthor | null;
  claimed_at: string | null;
  depends_on?: string[];
  deliverables: SliceDeliverables;
  evidence: Evidence[];
}
