import { SliceOwnerRole, SliceV2 } from "../types/slices-v2.js";

const baseFields = (slice: SliceV2) => ({
  slice_id: slice.slice_id,
  req_id: slice.req_id,
  title: slice.title,
  owner_role: slice.owner_role,
  status: slice.status,
  depends_on: slice.depends_on ?? [],
  claimed_by: slice.claimed_by,
  claimed_at: slice.claimed_at
});

export function buildSliceView(slice: SliceV2, role: SliceOwnerRole) {
  if (role === "pm") {
    return {
      slice: {
        ...baseFields(slice),
        deliverables: slice.deliverables,
        evidence: slice.evidence
      }
    };
  }

  if (role === "architect") {
    return {
      slice: {
        ...baseFields(slice),
        deliverables: {
          architect: {
            design_spec: slice.deliverables.architect.design_spec
          }
        }
      }
    };
  }

  if (role === "coder") {
    return {
      slice: {
        ...baseFields(slice),
        deliverables: {
          architect: {
            design_spec: slice.deliverables.architect.design_spec
          },
          coder: {
            implementation_notes: slice.deliverables.coder.implementation_notes,
            pr: slice.deliverables.coder.pr
          }
        }
      }
    };
  }

  return {
    slice: {
      ...baseFields(slice),
      deliverables: {
        architect: {
          design_spec: slice.deliverables.architect.design_spec
        },
        coder: {
          implementation_notes: slice.deliverables.coder.implementation_notes,
          pr: slice.deliverables.coder.pr
        },
        tester: {
          test_plan: slice.deliverables.tester.test_plan,
          test_results: slice.deliverables.tester.test_results
        }
      }
    }
  };
}
