import { RequirementV2 } from "../types/requirements-v2.js";

const requirements = new Map<string, RequirementV2>();

export function clearRequirementsStore() {
  requirements.clear();
}

export function getRequirement(reqId: string): RequirementV2 | null {
  return requirements.get(reqId) ?? null;
}

export function bulkCreateRequirements(
  items: RequirementV2[]
): { ok: true } | { ok: false; duplicates: string[] } {
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.req_id)) {
      duplicates.add(item.req_id);
    }
    seen.add(item.req_id);
    if (requirements.has(item.req_id)) {
      duplicates.add(item.req_id);
    }
  }

  if (duplicates.size > 0) {
    return { ok: false, duplicates: Array.from(duplicates) };
  }

  for (const item of items) {
    requirements.set(item.req_id, item);
  }

  return { ok: true };
}
