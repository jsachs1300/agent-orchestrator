import { ToolRequest, ToolResult } from "../core/types";
import { echoTool } from "./echo.tool";

export type ToolHandler = (req: ToolRequest) => Promise<ToolResult>;

const registry: Record<string, ToolHandler> = {
  "echo.tool": echoTool
  // "git.apply_changes": gitApplyChangesTool,
  // "repo.read_tree": repoReadTreeTool,
};

export async function dispatchTool(req: ToolRequest): Promise<ToolResult> {
  const handler = registry[req.name];
  if (!handler) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: `Unknown tool: ${req.name}`
    };
  }

  return handler(req);
}
