import { getRedisClient } from "../redis.js";
import { SliceV2 } from "../types/slices-v2.js";

const SLICES_SET = "v2:slices";
const SLICE_PREFIX = "v2:slice:";

function sliceKey(sliceId: string) {
  return `${SLICE_PREFIX}${sliceId}`;
}

export async function clearSlicesStore() {
  const redis = await getRedisClient();
  const ids = await redis.sMembers(SLICES_SET);
  const keys = ids.map((id) => sliceKey(id));

  const multi = redis.multi();
  multi.del(SLICES_SET, ...keys);
  await multi.exec();
}

export async function getSlice(sliceId: string): Promise<SliceV2 | null> {
  const redis = await getRedisClient();
  const raw = await redis.get(sliceKey(sliceId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SliceV2;
  } catch {
    return null;
  }
}

export async function bulkCreateSlices(
  items: SliceV2[]
): Promise<{ ok: true } | { ok: false; duplicates: string[] }> {
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

  const redis = await getRedisClient();
  const ids = Array.from(seen);
  if (ids.length > 0) {
    const multi = redis.multi();
    for (const id of ids) {
      multi.sIsMember(SLICES_SET, id);
    }
    const results = await multi.exec();
    if (results) {
      results.forEach((result, index) => {
        if (result === 1) {
          duplicates.add(ids[index]);
        }
      });
    }
  }

  if (duplicates.size > 0) {
    return { ok: false, duplicates: Array.from(duplicates) };
  }

  const multi = redis.multi();
  for (const item of items) {
    multi.set(sliceKey(item.slice_id), JSON.stringify(item));
    multi.sAdd(SLICES_SET, item.slice_id);
  }
  await multi.exec();

  return { ok: true };
}
