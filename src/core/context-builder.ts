import { Session } from "./types";

const MAX_MESSAGES_PER_THREAD_IN_CONTEXT = 10;

export interface OrchestratorContext {
  session: {
    id: string;
    goal: string | null;
    metadata: Record<string, any>;
  };
  current_context: any;
  threads: Record<
    string,
    Array<{
      from: string;
      to: string;
      role: string;
      content: string;
      toolName: string | null;
      toolCallId: string | null;
      timestamp: string;
    }>
  >;
}

/**
 * Build the context structure we send to the LLM as the "user" content.
 */
export function buildContext(session: Session): OrchestratorContext {
  const summaryThreads: OrchestratorContext["threads"] = {};

  for (const [threadId, thread] of Object.entries(session.threads)) {
    const recent = thread.messages.slice(-MAX_MESSAGES_PER_THREAD_IN_CONTEXT);
    summaryThreads[threadId] = recent.map((m) => ({
      from: m.from,
      to: m.to,
      role: m.role,
      content: m.content,
      toolName: m.toolName ?? null,
      toolCallId: m.toolCallId ?? null,
      timestamp: m.timestamp
    }));
  }

  return {
    session: {
      id: session.id,
      goal: session.goal ?? null,
      metadata: session.metadata
    },
    current_context: session.context ?? null,
    threads: summaryThreads
  };
}
