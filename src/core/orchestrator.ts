import { v4 as uuid } from "uuid";
import {
  Message,
  Session,
  ToolRequest,
  ToolCallAction
} from "./types";
import { appendMessage } from "./session-store";
import { buildContext } from "./context-builder";
import { parseOrchestratorResponse } from "./parser";
import { callLlm } from "../llm";
import { SYSTEM_PROMPT } from "../llm/prompts/orchestrator-system";
import { dispatchTool } from "../tools";

const MAX_CYCLES_PER_TURN = 4;

/**
 * Run one orchestration turn starting from a new user message.
 * Returns all user-visible messages produced in this turn.
 */
export async function runOrchestrationTurn(
  session: Session,
  userText: string
): Promise<string[]> {
  const now = new Date().toISOString();

  const incomingUserMsg: Message = {
    id: uuid(),
    from: "user",
    to: "llm",
    role: "user",
    threadId: "user",
    content: userText,
    timestamp: now
  };
  await appendMessage(session, "user", incomingUserMsg);

  const userVisibleMessages: string[] = [];
  let cycles = 0;
  let done = false;

  while (cycles < MAX_CYCLES_PER_TURN && !done) {
    cycles++;

    const contextObj = buildContext(session);
    const contextJson = JSON.stringify(contextObj, null, 2);

    const llmMessages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT
      },
      {
        role: "user" as const,
        content: contextJson
      }
    ];

    const raw = await callLlm(llmMessages);
    const resp = parseOrchestratorResponse(raw);

    const toolCalls: ToolCallAction[] = [];

    for (const action of resp.actions) {
      if (action.type === "send_message") {
        const content = action.content;
        userVisibleMessages.push(content);

        const msg: Message = {
          id: uuid(),
          from: "llm",
          to: "user",
          role: "assistant",
          threadId: "user",
          content,
          timestamp: new Date().toISOString()
        };
        await appendMessage(session, "user", msg);
      }

      if (action.type === "tool_call") {
        toolCalls.push(action);

        const toolReq: ToolRequest = {
          callId: action.target.call_id,
          name: action.target.tool,
          params: action.params
        };

        const toolRes = await dispatchTool(toolReq, session);
        const toolContent = JSON.stringify(toolRes);

        const toolMsg: Message = {
          id: uuid(),
          from: "tool",
          to: "llm",
          role: "assistant",
          threadId: action.target.thread,
          content: toolContent,
          toolName: toolRes.name,
          toolCallId: toolRes.callId,
          timestamp: new Date().toISOString()
        };

        await appendMessage(session, action.target.thread, toolMsg);
      }
    }

    const wantsDone = resp.control?.done === true;
    if (wantsDone || toolCalls.length === 0) {
      done = true;
    }
  }

  return userVisibleMessages;
}
