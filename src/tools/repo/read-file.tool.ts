import fs from "fs/promises";
import path from "path";
import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

export const readFileTool: ToolHandler = async (
  req: ToolRequest
): Promise<ToolResult> => {
  const filePath = req.params?.path;

  if (!filePath || typeof filePath !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "Missing or invalid 'path' parameter"
    };
  }

  const resolvedPath = path.resolve(filePath);

  try {
    const content = await fs.readFile(resolvedPath, "utf8");
    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        path: filePath,
        content
      }
    };
  } catch (error: any) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: error?.message || "Failed to read file"
    };
  }
};
