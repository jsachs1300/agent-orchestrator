import { createClient, RedisClientType } from "redis";
import { Requirement, Role } from "./types/state.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const REQUIREMENTS_SET = "requirements";
const PRIORITY_ZSET = "priority";
const AUDIT_STREAM = "audit_log";
const STATUS_SETS = ["not_started", "in_progress", "blocked", "in_review", "completed"] as const;

let client: RedisClientType | null = null;
let hasJsonSupport: boolean | null = null;

export interface AuditActor {
  role: Role;
  id: string;
}

function priorityScore(priority: Requirement["priority"]): number {
  const tierMap: Record<string, number> = { p0: 0, p1: 1, p2: 2 };
  const tierValue = tierMap[priority.tier] ?? 0;
  return tierValue + priority.rank;
}

function normalizeOverallStatus(status?: string): Requirement["overall_status"] {
  switch (status) {
    case "ready_for_pm_review":
      return "in_review";
    case "done":
      return "completed";
    case "blocked":
      return "blocked";
    case "open":
      return "not_started";
    default:
      return (status as Requirement["overall_status"]) ?? "not_started";
  }
}

function normalizeRequirement(id: string, requirement: any): Requirement {
  if (requirement?.sections) {
    return {
      req_id: requirement.req_id ?? requirement.id ?? id,
      title: requirement.title ?? "",
      priority: requirement.priority ?? { tier: "", rank: 0 },
      overall_status: normalizeOverallStatus(requirement.overall_status),
      sections: requirement.sections
    };
  }

  return {
    req_id: requirement?.req_id ?? requirement?.id ?? id,
    title: requirement?.title ?? "",
    priority: requirement?.priority ?? { tier: "", rank: 0 },
    overall_status: normalizeOverallStatus(requirement?.status ?? requirement?.overall_status),
    sections: {
      pm: requirement?.pm ?? {
        status: "unaddressed",
        direction: "",
        feedback: "",
        decision: "pending"
      },
      architect: requirement?.architecture ?? {
        status: "unaddressed",
        design_spec: ""
      },
      coder: requirement?.engineering ?? {
        status: "unaddressed",
        implementation_notes: "",
        pr: null
      },
      tester: requirement?.qa ?? {
        status: "unaddressed",
        test_plan: "",
        test_cases: [],
        test_results: { status: "", notes: "" }
      }
    }
  };
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (client) {
    return client;
  }

  client = createClient({ url: redisUrl });
  client.on("error", (err) => {
    console.error("Redis client error", err);
  });

  await client.connect();
  return client;
}

async function detectJsonSupport(clientInstance: RedisClientType): Promise<boolean> {
  if (hasJsonSupport !== null) {
    return hasJsonSupport;
  }

  try {
    await clientInstance.sendCommand(["JSON.GET", "__json_probe__"]);
    hasJsonSupport = true;
  } catch (err: any) {
    const message = String(err?.message || err).toLowerCase();
    if (message.includes("unknown command")) {
      hasJsonSupport = false;
    } else {
      throw err;
    }
  }

  return hasJsonSupport;
}

async function readJson(clientInstance: RedisClientType, key: string): Promise<string | null> {
  const useJson = await detectJsonSupport(clientInstance);
  if (useJson) {
    const jsonResult = (await clientInstance.sendCommand(["JSON.GET", key])) as string | null;
    return jsonResult ?? null;
  }
  return clientInstance.get(key);
}

async function writeJson(clientInstance: RedisClientType, key: string, payload: string) {
  const useJson = await detectJsonSupport(clientInstance);
  if (useJson) {
    await clientInstance.sendCommand(["JSON.SET", key, "$", payload]);
  } else {
    await clientInstance.set(key, payload);
  }
}

async function migrateLegacyStateIfPresent(redis: RedisClientType) {
  const existingIds = await redis.sMembers(REQUIREMENTS_SET);
  if (existingIds.length > 0) {
    return;
  }

  const raw = await readJson(redis, "state");
  if (!raw) {
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const legacyRequirements = parsed?.requirements ?? {};
  const entries = Object.entries(legacyRequirements);
  if (entries.length === 0) {
    return;
  }

  for (const [key, value] of entries) {
    const normalized = normalizeRequirement(key, value);
    await saveRequirement(normalized, { role: "system", id: "migration" }, "migrate", null);
  }
}

export async function getRequirement(reqId: string): Promise<Requirement | null> {
  const redis = await getRedisClient();
  await migrateLegacyStateIfPresent(redis);

  const raw = await readJson(redis, reqId);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeRequirement(reqId, parsed);
  } catch {
    return null;
  }
}

export async function listRequirements(): Promise<Record<string, Requirement>> {
  const redis = await getRedisClient();
  await migrateLegacyStateIfPresent(redis);

  const ids = await redis.sMembers(REQUIREMENTS_SET);
  if (ids.length === 0) {
    return {};
  }

  const requirements: Record<string, Requirement> = {};
  for (const id of ids) {
    const req = await getRequirement(id);
    if (req) {
      requirements[id] = req;
    }
  }
  return requirements;
}

export async function listTopRequirements(limit: number): Promise<Requirement[]> {
  const redis = await getRedisClient();
  await migrateLegacyStateIfPresent(redis);

  const count = Number.isInteger(limit) && limit > 0 ? limit : 1;
  const ids = await redis.zRange(PRIORITY_ZSET, 0, count - 1);

  const requirements: Requirement[] = [];
  for (const id of ids) {
    const requirement = await getRequirement(id);
    if (requirement) {
      requirements.push(requirement);
    }
  }

  return requirements;
}

export async function saveRequirement(
  requirement: Requirement,
  actor: AuditActor,
  action: string,
  previous: Requirement | null
): Promise<void> {
  const redis = await getRedisClient();
  const payload = JSON.stringify(requirement);
  const score = priorityScore(requirement.priority);

  const multi = redis.multi();
  const useJson = await detectJsonSupport(redis);

  if (useJson) {
    multi.sendCommand(["JSON.SET", requirement.req_id, "$", payload]);
  } else {
    multi.set(requirement.req_id, payload);
  }

  multi.sAdd(REQUIREMENTS_SET, requirement.req_id);
  multi.zAdd(PRIORITY_ZSET, [{ score, value: requirement.req_id }]);

  for (const status of STATUS_SETS) {
    if (status !== requirement.overall_status) {
      multi.sRem(status, requirement.req_id);
    }
  }
  multi.sAdd(requirement.overall_status, requirement.req_id);

  const details = JSON.stringify({
    overall_status: requirement.overall_status,
    priority: requirement.priority
  });

  multi.xAdd(AUDIT_STREAM, "*", {
    ts: new Date().toISOString(),
    actor_role: actor.role,
    actor_id: actor.id,
    action,
    req_id: requirement.req_id,
    outcome: "success",
    details
  });

  await multi.exec();
}
