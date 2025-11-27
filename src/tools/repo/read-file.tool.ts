import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

export const readFileTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const owner = req.params?.owner;
  const repo = req.params?.repo;
  const filePath = req.params?.path;
  const branch = req.params?.branch || "main";

  if (!owner || !repo || !filePath || typeof filePath !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'owner', 'repo', and string 'path' parameters are required"
    };
  }

  try {
    const { octokit, installationId } = await ctx.github.requireInstallation();
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch
    });

    if (!("content" in response.data)) {
      return {
        callId: req.callId,
        name: req.name,
        success: false,
        error: "Requested path is not a file"
      };
    }

    const data = response.data;
    const encoding = data.encoding || "base64";
    const rawBuffer = Buffer.from(data.content, encoding as BufferEncoding);
    const content = rawBuffer.toString("utf8");

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        installationId,
        repo: `${owner}/${repo}`,
        branch,
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
