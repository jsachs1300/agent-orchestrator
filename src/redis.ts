import { createClient, RedisClientType } from "redis";
import { Requirement, State } from "./types/state.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let client: RedisClientType | null = null;
let hasJsonSupport: boolean | null = null;

function defaultState(): State {
  return {
    schema_version: "1.0",
    updated_at: new Date().toISOString(),
    requirements: {}
  };
}

function mapLegacyStatus(status: string | undefined): Requirement["overall_status"] {
  switch (status) {
    case "ready_for_pm_review":
      return "in_review";
    case "done":
      return "completed";
    case "blocked":
      return "blocked";
    case "open":
    default:
      return "not_started";
  }
}

function normalizeRequirement(id: string, requirement: any): Requirement {
  const reqId = requirement.req_id ?? requirement.id ?? id;
  const title = requirement.title ?? "";
  const priority = requirement.priority ?? { tier: "", rank: 0 };
  const overallStatus =
    requirement.overall_status ?? mapLegacyStatus(requirement.status ?? requirement.overallStatus);

  if (requirement.sections) {
    return {
      req_id: reqId,
      title,
      priority,
      overall_status: overallStatus,
      sections: requirement.sections
    } as Requirement;
  }

  return {
    req_id: reqId,
    title,
    priority,
    overall_status: overallStatus,
    sections: {
      pm: requirement.pm ?? { status: "unaddressed", direction: "", feedback: "", decision: "pending" },
      architect: requirement.architecture ?? { status: "unaddressed", design_spec: "" },
      coder: requirement.engineering ?? { status: "unaddressed", implementation_notes: "", pr: null },
      tester: requirement.qa ?? {
        status: "unaddressed",
        test_plan: "",
        test_cases: [],
        test_results: { status: "", notes: "" }
      }
    }
  };
}

function normalizeState(state: State): State {
  const normalizedRequirements: Record<string, Requirement> = {};
  for (const [key, value] of Object.entries(state.requirements ?? {})) {
    normalizedRequirements[key] = normalizeRequirement(key, value);
  }

  return {
    schema_version: "1.0",
    updated_at: state.updated_at ?? new Date().toISOString(),
    requirements: normalizedRequirements
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
    await clientInstance.sendCommand(["JSON.GET", "state"]);
    hasJsonSupport = true;
  } catch (err: any) {
    const message = String(err?.message || err);
    const normalized = message.toLowerCase();
    if (normalized.includes("unknown command")) {
      hasJsonSupport = false;
    } else if (normalized.includes("wrongtype")) {
      hasJsonSupport = false;
    } else {
      throw err;
    }
  }

  return hasJsonSupport;
}

export async function getState(): Promise<State> {
  const redis = await getRedisClient();
  const useJson = await detectJsonSupport(redis);

  let raw: string | null = null;

  if (useJson) {
    const jsonResult = (await redis.sendCommand(["JSON.GET", "state"])) as string | null;
    raw = jsonResult ?? null;
  } else {
    raw = await redis.get("state");
  }

  if (!raw) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(raw) as State;
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

export async function setState(state: State): Promise<void> {
  const redis = await getRedisClient();
  const useJson = await detectJsonSupport(redis);

  const normalized: State = {
    ...state,
    schema_version: "1.0",
    updated_at: new Date().toISOString()
  };

  const payload = JSON.stringify(normalized);

  if (useJson) {
    await redis.sendCommand(["JSON.SET", "state", "$", payload]);
  } else {
    await redis.set("state", payload);
  }
}
