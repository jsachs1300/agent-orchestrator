import { SliceV2 } from "../types/slices-v2.js";

const slices = new Map<string, SliceV2>();

export function clearSlicesStore() {
  slices.clear();
}

export function getSlice(sliceId: string): SliceV2 | null {
  return slices.get(sliceId) ?? null;
}

export function bulkCreateSlices(
  items: SliceV2[]
): { ok: true } | { ok: false; duplicates: string[] } {
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.slice_id)) {
      duplicates.add(item.slice_id);
    }
    seen.add(item.slice_id);
  }

  if (duplicates.size > 0) {
    return { ok: false, duplicates: Array.from(duplicates) };
  }

  for (const id of seen) {
    if (slices.has(id)) {
      duplicates.add(id);
    }
  }

  if (duplicates.size > 0) {
    return { ok: false, duplicates: Array.from(duplicates) };
  }

  for (const item of items) {
    slices.set(item.slice_id, item);
  }

  return { ok: true };
}
