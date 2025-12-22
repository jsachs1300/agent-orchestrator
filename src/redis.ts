import { createClient, RedisClientType } from "redis";
import { State } from "./types/state.js";

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
    return parsed;
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
