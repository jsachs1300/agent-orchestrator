import { Session, Thread, ThreadKind, Message } from "./types";

const sessions = new Map<string, Session>();

export function getOrCreateSession(id: string): Session {
  let session = sessions.get(id);
  const now = new Date().toISOString();

  if (!session) {
    session = {
      id,
      goal: undefined,
      metadata: {},
      threads: {},
      createdAt: now,
      updatedAt: now
    };

    // user thread by default
    session.threads["user"] = createThread("user", "user", "user");
    sessions.set(id, session);
  }

  return session;
}

export function saveSession(session: Session): void {
  session.updatedAt = new Date().toISOString();
  sessions.set(session.id, session);
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

export function appendMessage(
  session: Session,
  threadId: string,
  msg: Message
): void {
  let thread = session.threads[threadId];
  if (!thread) {
    const kind: ThreadKind = threadId === "user" ? "user" : "tool";
    thread = createThread(threadId, threadId === "user" ? "user" : threadId, kind);
    session.threads[threadId] = thread;
  }

  thread.messages.push(msg);
  session.updatedAt = new Date().toISOString();
  saveSession(session);
}
