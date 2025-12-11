import { v4 as uuid } from "uuid";
import {
  DebugActionRecord,
  Message,
  Session,
  ToolRequest,
  ToolCallAction
} from "./types";
import {
  appendDebugExchange,
  appendMessage,
  setSessionContext
} from "./session-store";
import { buildContext } from "./context-builder";
import { parseOrchestratorResponse } from "./parser";
import { callLlm } from "../llm";
import { SYSTEM_PROMPT } from "../llm/prompts/orchestrator-system";
import { dispatchTool } from "../tools";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

    const llmMessages: ChatCompletionMessageParam[] = [
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

    const actionRecords: DebugActionRecord[] = [];
    const cycleTimestamp = new Date().toISOString();

    if (resp.context) {
      await setSessionContext(session, resp.context);
    }

    const toolCalls: ToolCallAction[] = [];

    for (const action of resp.actions) {
      if (action.type === "send_message") {
        const content = action.content;
        userVisibleMessages.push(content);

        actionRecords.push({
          type: "send_message",
          content
        });

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

        const toolRecord: DebugActionRecord = {
          type: "tool_call",
          tool: action.target.tool,
          params: action.params
        };
        actionRecords.push(toolRecord);

        const toolReq: ToolRequest = {
          callId: action.target.call_id,
          name: action.target.tool,
          params: action.params
        };

        const toolRes = await dispatchTool(toolReq, session);
        const toolContent = JSON.stringify(toolRes);

        toolRecord.result = toolRes;

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

    const debugExchange = {
      id: uuid(),
      cycle: cycles,
      timestamp: cycleTimestamp,
      llmRequest: llmMessages,
      llmResponseRaw: raw,
      parsedResponse: resp,
      actions: actionRecords
    };

    await appendDebugExchange(session, debugExchange);
  }

  return userVisibleMessages;
}
