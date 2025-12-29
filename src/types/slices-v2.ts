export type SliceOwnerRole = "pm" | "architect" | "coder" | "tester";

export interface SliceDeliverables {
  architect: { design_spec: null };
  coder: { implementation_notes: null; pr: null };
  tester: { test_plan: null; test_results: null };
}

export interface SliceV2 {
  slice_id: string;
  req_id: string;
  title: string;
  owner_role: SliceOwnerRole;
  status: "not_started";
  depends_on?: string[];
  deliverables: SliceDeliverables;
  evidence: [];
}
