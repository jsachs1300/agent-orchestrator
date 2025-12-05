import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

function normalizeRef(branchName: string): string {
  return branchName.startsWith("refs/") ? branchName : `heads/${branchName}`;
}

export const createBranchTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const owner = req.params?.owner;
  const repo = req.params?.repo;
  const branch = req.params?.branch;
  const from = req.params?.from || "main";

  if (!owner || !repo || !branch) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'owner', 'repo', and 'branch' parameters are required"
    };
  }

  try {
    const { octokit, installationId } = await ctx.github.requireInstallation();
    const baseRef = await octokit.git.getRef({
      owner,
      repo,
      ref: normalizeRef(from)
    });

    const sha = baseRef.data.object.sha;

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha
    });

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        installationId,
        repo: `${owner}/${repo}`,
        branch,
        from,
        baseSha: sha
      }
    };
  } catch (error: any) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: error?.message || "Failed to create branch"
    };
  }
};
