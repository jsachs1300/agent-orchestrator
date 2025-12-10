export interface RedisClientLike {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  hSet(key: string, field: string, value: string): Promise<void>;
  hVals(key: string): Promise<string[]>;
  hDel(key: string, field: string): Promise<void>;
  on?(event: string, listener: (...args: any[]) => void): void;
}

function createMemoryClient(): RedisClientLike {
  const kv = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();

  return {
    async connect() {
      return;
    },
    async get(key: string) {
      return kv.get(key) ?? null;
    },
    async set(key: string, value: string) {
      kv.set(key, value);
    },
    async hSet(key: string, field: string, value: string) {
      const bucket = hashes.get(key) ?? new Map<string, string>();
      bucket.set(field, value);
      hashes.set(key, bucket);
    },
    async hVals(key: string) {
      const bucket = hashes.get(key);
      return bucket ? Array.from(bucket.values()) : [];
    },
    async hDel(key: string, field: string) {
      const bucket = hashes.get(key);
      if (!bucket) return;
      bucket.delete(field);
      if (bucket.size === 0) {
        hashes.delete(key);
      }
    },
    on() {
      return;
    }
  };
}

let clientPromise: Promise<RedisClientLike | null> | null = null;

async function initRedisClient(): Promise<RedisClientLike | null> {
  if (clientPromise) return clientPromise;

  const url = process.env.REDIS_URL || process.env.REDIS_URL_INTERNAL;

  clientPromise = (async () => {
    if (!url) {
      return createMemoryClient();
    }

    try {
      const redis = await import("redis");
      const client = redis.createClient({ url });
      client.on?.("error", err => {
        console.warn("Redis client error", err);
      });
      await client.connect();
      return client as unknown as RedisClientLike;
    } catch (err) {
      console.warn("Failed to connect to Redis; using in-memory store", err);
      return createMemoryClient();
    }
  })();

  return clientPromise;
}

export async function getRedisClient(): Promise<RedisClientLike | null> {
  return initRedisClient();
}
