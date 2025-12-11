import { v4 as uuid } from "uuid";
import {
  Session,
  Thread,
  ThreadKind,
  Message,
  SessionToolConfig,
  SessionContext,
  DebugExchange
} from "./types";
import { initRedisClient } from "./redis-client";

const sessions = new Map<string, Session>();
const SESSION_KEY_PREFIX = "session:";

type PersistableSessionFields = {
  id: string;
  goal?: string;
  metadata: Record<string, any>;
  context?: SessionContext;
  tools?: Record<string, SessionToolConfig>;
  threads?: Record<string, Thread>;
  debugLog?: DebugExchange[];
  createdAt?: string;
  updatedAt?: string;
};

export interface CreateSessionOptions {
  id?: string;
  goal?: string;
  metadata?: Record<string, any>;
  context?: SessionContext;
  tools?: SessionToolConfig[];
}

function getRedisKey(id: string): string {
  return `${SESSION_KEY_PREFIX}${id}`;
}

async function loadSession(id: string): Promise<Session | null> {
  const cached = sessions.get(id);
  if (cached) return cached;

  const client = await initRedisClient();
  if (client) {
    const raw = (await client.sendCommand(["GET", getRedisKey(id)])) as
      | string
      | null;
    if (raw && typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as PersistableSessionFields;
        const revived = reviveSession(parsed);
        sessions.set(id, revived);
        return revived;
      } catch (err) {
        console.error(`Failed to parse session ${id} from Redis`, err);
      }
    }
  }

  return null;
}

function reviveSession(raw: PersistableSessionFields): Session {
  const now = new Date().toISOString();
  const revived: Session = {
    id: raw.id,
    goal: raw.goal,
    metadata: raw.metadata ?? {},
    context: raw.context ?? {},
    tools: raw.tools ?? {},
    threads: raw.threads ?? {},
    debugLog: raw.debugLog ?? [],
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now
  };

  if (!revived.threads["user"]) {
    revived.threads["user"] = createThread("user", "user", "user");
  }

  return revived;
}

export async function createSession(
  options: CreateSessionOptions = {}
): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: options.id ?? uuid(),
    goal: options.goal,
    metadata: options.metadata ?? {},
    context: options.context ?? {},
    tools: {},
    threads: {},
    debugLog: [],
    createdAt: now,
    updatedAt: now
  };

  session.threads["user"] = createThread("user", "user", "user");

  for (const tool of options.tools ?? []) {
    session.tools[tool.name] = {
      name: tool.name,
      enabled: tool.enabled,
      config: tool.config,
      lastUsedAt: tool.lastUsedAt
    };
  }

  await saveSession(session);
  return session;
}

export async function getOrCreateSession(id: string): Promise<Session> {
  const existing = await loadSession(id);
  if (existing) {
    return existing;
  }

  return createSession({ id });
}

async function persistSession(session: Session): Promise<void> {
  sessions.set(session.id, session);
  const client = await initRedisClient();
  if (!client) return;

  const payload: PersistableSessionFields = {
    id: session.id,
    goal: session.goal,
    metadata: session.metadata,
    context: session.context,
    tools: session.tools,
    threads: session.threads,
    debugLog: session.debugLog,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };

  try {
    await client.sendCommand(["SET", getRedisKey(session.id), JSON.stringify(payload)]);
  } catch (err) {
    console.error(`Failed to persist session ${session.id} to Redis`, err);
  }
}

export async function saveSession(session: Session): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await persistSession(session);
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

export async function appendDebugExchange(
  session: Session,
  exchange: DebugExchange
): Promise<void> {
  session.debugLog.push(exchange);
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
}

export async function setSessionContext(
  session: Session,
  context: SessionContext
): Promise<Session> {
  session.context = context;
  await saveSession(session);
  return session;
}

export async function setSessionTools(
  session: Session,
  tools: SessionToolConfig[]
): Promise<Session> {
  session.tools = tools.reduce<Record<string, SessionToolConfig>>((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {});
  await saveSession(session);
  return session;
}
