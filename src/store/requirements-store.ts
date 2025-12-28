import { getRedisClient } from "../redis.js";
import { RequirementV2 } from "../types/requirements-v2.js";

const REQUIREMENTS_SET = "v2:requirements";
const REQUIREMENT_PREFIX = "v2:requirement:";

function requirementKey(reqId: string) {
  return `${REQUIREMENT_PREFIX}${reqId}`;
}

export async function clearRequirementsStore() {
  const redis = await getRedisClient();
  const ids = await redis.sMembers(REQUIREMENTS_SET);
  const keys = ids.map((id) => requirementKey(id));

  const multi = redis.multi();
  multi.del(REQUIREMENTS_SET, ...keys);
  await multi.exec();
}

export async function getRequirement(reqId: string): Promise<RequirementV2 | null> {
  const redis = await getRedisClient();
  const raw = await redis.get(requirementKey(reqId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RequirementV2;
  } catch {
    return null;
  }
}

export async function bulkCreateRequirements(
  items: RequirementV2[]
): Promise<{ ok: true } | { ok: false; duplicates: string[] }> {
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.req_id)) {
      duplicates.add(item.req_id);
    }
    seen.add(item.req_id);
  }

  if (duplicates.size > 0) {
    return { ok: false, duplicates: Array.from(duplicates) };
  }

  const redis = await getRedisClient();
  const ids = Array.from(seen);
  if (ids.length > 0) {
    const multi = redis.multi();
    for (const id of ids) {
      multi.sIsMember(REQUIREMENTS_SET, id);
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
    multi.set(requirementKey(item.req_id), JSON.stringify(item));
    multi.sAdd(REQUIREMENTS_SET, item.req_id);
  }
  await multi.exec();

  return { ok: true };
}
