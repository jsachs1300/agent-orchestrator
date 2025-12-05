import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

function toBase64(content: string): string {
  return Buffer.from(content, "utf8").toString("base64");
}

export const writeFileTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const owner = req.params?.owner;
  const repo = req.params?.repo;
  const path = req.params?.path;
  const content = req.params?.content;
  const branch = req.params?.branch || "main";
  const message = req.params?.message || `Update ${path}`;
  let sha: string | undefined = req.params?.sha;

  if (!owner || !repo || !path || typeof content !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error:
        "'owner', 'repo', 'path', and string 'content' parameters are required"
    };
  }

  try {
    const { octokit, installationId } = await ctx.github.requireInstallation();

    if (!sha) {
      try {
        const existing = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch
        });

        if ("sha" in existing.data && typeof existing.data.sha === "string") {
          sha = existing.data.sha;
        }
      } catch (error: any) {
        if (error?.status !== 404) {
          throw error;
        }
      }
    }

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: toBase64(content),
      branch,
      sha
    });

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        installationId,
        repo: `${owner}/${repo}`,
        path,
        branch,
        commit: response.data.commit.sha,
        blob: response.data.content?.sha
      }
    };
  } catch (error: any) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: error?.message || "Failed to write file"
    };
  }
};
