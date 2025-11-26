import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

/**
 * Mock repo tree — replace later with real GitHub / local FS read.
 */
const MOCK_TREE = [
  { path: "src/", type: "dir" },
  { path: "src/index.ts", type: "file" },
  { path: "src/app/", type: "dir" },
  { path: "src/app/index.ts", type: "file" },
  { path: "src/core/", type: "dir" },
  { path: "src/core/orchestrator.ts", type: "file" },
  { path: "README.md", type: "file" }
];

export const readTreeTool: ToolHandler = async (
  req: ToolRequest
): Promise<ToolResult> => {
  return {
    callId: req.callId,
    name: req.name,
    success: true,
    result: {
      repo: req.params.repo || null,
      branch: req.params.branch || "main",
      tree: MOCK_TREE
    }
  };
};
