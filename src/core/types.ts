import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Core shared types for sessions, threads, messages, and LLM contract.

export type ParticipantType = "user" | "tool" | "llm";
export type ThreadKind = "user" | "tool" | "system";
export type ThreadId = string; // e.g. "user", "tool:git"

export interface Message {
  id: string;
  from: ParticipantType;
  to: "user" | string; // "user" or "tool:..." name
  role: "user" | "assistant" | "system";
  threadId: ThreadId;
  content: string;
  toolName?: string;
  toolCallId?: string;
  timestamp: string;
}

export interface Thread {
  id: ThreadId;
  kind: ThreadKind;
  counterparty: "user" | string; // "user" or "tool:git", etc.
  messages: Message[];
}

export interface SessionToolConfig {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  lastUsedAt?: string;
}

export type SessionContext = Record<string, any>;

export interface Session {
  id: string;
  goal?: string;
  metadata: Record<string, any>;
  context: SessionContext;
  tools: Record<string, SessionToolConfig>;
  threads: Record<ThreadId, Thread>;
  debugLog: DebugExchange[];
  createdAt: string;
  updatedAt: string;
}

export interface DebugActionRecord {
  type: "send_message" | "tool_call";
  content?: string;
  tool?: string;
  params?: any;
  result?: any;
}

export interface DebugExchange {
  id: string;
  cycle: number;
  timestamp: string;
  llmRequest: ChatCompletionMessageParam[];
  llmResponseRaw: string;
  parsedResponse: OrchestratorResponse;
  actions: DebugActionRecord[];
}

/**
 * LLM contract types
 */

export type TargetUser = {
  type: "user";
  thread: "user";
};

export type TargetTool = {
  type: "tool";
  thread: string;
  tool: string;
  call_id: string;
};

export type SendMessageAction = {
  type: "send_message";
  target: TargetUser;
  content: string;
};

export type ToolCallAction = {
  type: "tool_call";
  target: TargetTool;
  params: any;
};

export type OrchestratorAction = SendMessageAction | ToolCallAction;

export interface OrchestratorControl {
  done?: boolean;
  note?: string;
}

export interface OrchestratorResponse {
  actions: OrchestratorAction[];
  control?: OrchestratorControl;
  /**
   * Optional session context to persist and send back to the LLM on the next turn.
   * The LLM should keep this as compact as possible while retaining necessary state.
   */
  context?: SessionContext;
}

/**
 * Tool types
 */

export interface ToolRequest {
  callId: string;
  name: string; // e.g. "git.apply_changes"
  params: any;
}

export interface ToolResult {
  callId: string;
  name: string;
  success: boolean;
  result?: any;
  error?: string;
}
