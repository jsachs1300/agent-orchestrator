import { NextSliceRole, SliceV2 } from "../types/slices-v2.js";
import { listSlicesInOrder } from "./slices-store.js";

export async function findNextSlice(role: NextSliceRole): Promise<SliceV2 | null> {
  const slices = await listSlicesInOrder();
  if (slices.length === 0) {
    return null;
  }

  const sliceMap = new Map(slices.map((slice) => [slice.slice_id, slice]));
  return (
    slices.find((slice) => {
      if (slice.owner_role !== role) {
        return false;
      }
      if (slice.claimed_by) {
        return false;
      }
      if (slice.status === "done") {
        return false;
      }
      if (slice.depends_on && slice.depends_on.length > 0) {
        const dependenciesReady = slice.depends_on.every((dependency) => {
          const dependencySlice = sliceMap.get(dependency);
          return dependencySlice?.status === "done";
        });
        if (!dependenciesReady) {
          return false;
        }
      }
      return true;
    }) ?? null
  );
}
