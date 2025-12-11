import { Session } from "./types";

const MAX_MESSAGES_PER_THREAD_IN_CONTEXT = 10;

export interface OrchestratorContext {
  session: {
    id: string;
    goal: string | null;
    metadata: Record<string, any>;
    context: Record<string, any>;
    tools: Array<{
      name: string;
      enabled: boolean;
      config: Record<string, any>;
      lastUsedAt: string | null;
    }>;
  };
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
      metadata: session.metadata,
      context: session.context,
      tools: Object.values(session.tools).map((tool) => ({
        name: tool.name,
        enabled: tool.enabled,
        config: tool.config,
        lastUsedAt: tool.lastUsedAt ?? null
      }))
    },
    threads: summaryThreads
  };
}
