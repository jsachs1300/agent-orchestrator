import { ToolHandler } from "./index";
import { ToolRequest, ToolResult } from "../core/types";

export const echoTool: ToolHandler = async (
  req: ToolRequest,
  _ctx
): Promise<ToolResult> => {
  return {
    callId: req.callId,
    name: req.name,
    success: true,
    result: {
      echoed: req.params ?? null
    }
  };
};
