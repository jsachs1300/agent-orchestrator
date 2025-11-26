import {
  OrchestratorAction,
  OrchestratorResponse,
  ToolCallAction
} from "./types";

export function parseOrchestratorResponse(raw: string): OrchestratorResponse {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse LLM JSON: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM JSON is not an object");
  }

  if (!Array.isArray(parsed.actions)) {
    throw new Error("LLM JSON missing 'actions' array");
  }

  const actions: OrchestratorAction[] = [];

  for (const a of parsed.actions) {
    if (!a || typeof a !== "object") continue;

    if (a.type === "send_message") {
      if (
        !a.target ||
        a.target.type !== "user" ||
        a.target.thread !== "user" ||
        typeof a.content !== "string"
      ) {
        continue;
      }
      actions.push({
        type: "send_message",
        target: { type: "user", thread: "user" },
        content: a.content
      });
    }

    if (a.type === "tool_call") {
      if (
        !a.target ||
        a.target.type !== "tool" ||
        typeof a.target.thread !== "string" ||
        typeof a.target.tool !== "string" ||
        typeof a.target.call_id !== "string"
      ) {
        continue;
      }
      const toolAction: ToolCallAction = {
        type: "tool_call",
        target: {
          type: "tool",
          thread: a.target.thread,
          tool: a.target.tool,
          call_id: a.target.call_id
        },
        params: a.params ?? {}
      };
      actions.push(toolAction);
    }
  }

  const control =
    parsed.control && typeof parsed.control === "object"
      ? {
          done:
            typeof parsed.control.done === "boolean"
              ? parsed.control.done
              : undefined,
          note:
            typeof parsed.control.note === "string"
              ? parsed.control.note
              : undefined
        }
      : undefined;

  return { actions, control };
}
