import { Session, Thread, ThreadKind, Message } from "./types";
import { getRedisClient } from "./redis-client";

const memorySessions = new Map<string, Session>();
const SESSION_KEY_PREFIX = "session:";

async function readSessionFromRedis(id: string): Promise<Session | null> {
  const client = await getRedisClient();
  if (!client) return null;

  const raw = await client.get(`${SESSION_KEY_PREFIX}${id}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch (err) {
    console.warn(`Failed to parse session ${id} from Redis`, err);
    return null;
  }
}

async function writeSessionToRedis(session: Session): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  await client.set(`${SESSION_KEY_PREFIX}${session.id}`, JSON.stringify(session));
}

function ensureSessionDefaults(session: Session): Session {
  if (!session.metadata) {
    session.metadata = {};
  }
  if (!session.threads) {
    session.threads = {};
  }
  if (typeof session.context === "undefined") {
    session.context = null;
  }
  return session;
}

export async function getOrCreateSession(id: string): Promise<Session> {
  let session = memorySessions.get(id) || (await readSessionFromRedis(id));
  const now = new Date().toISOString();

  if (!session) {
    session = {
      id,
      goal: undefined,
      metadata: {},
      threads: {},
      createdAt: now,
      updatedAt: now,
      context: null
    };

    // user thread by default
    session.threads["user"] = createThread("user", "user", "user");
    await saveSession(session);
  }

  return ensureSessionDefaults(session);
}

export async function saveSession(session: Session): Promise<void> {
  session.updatedAt = new Date().toISOString();
  memorySessions.set(session.id, session);
  await writeSessionToRedis(session);
}

export function createThread(
  id: string,
  counterparty: "user" | string,
  kind: ThreadKind
): Thread {
  return {
    id,
    counterparty,
    kind,
    messages: []
  };
}

export async function appendMessage(
  session: Session,
  threadId: string,
  msg: Message
): Promise<void> {
  let thread = session.threads[threadId];
  if (!thread) {
    const kind: ThreadKind = threadId === "user" ? "user" : "tool";
    thread = createThread(threadId, threadId === "user" ? "user" : threadId, kind);
    session.threads[threadId] = thread;
  }

  thread.messages.push(msg);
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
}
