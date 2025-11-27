import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

export const readTreeTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const owner = req.params?.owner;
  const repo = req.params?.repo;
  const branch = req.params?.branch || "main";

  if (!owner || !repo) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "Both 'owner' and 'repo' parameters are required"
    };
  }

  try {
    const { octokit, installationId } = await ctx.github.requireInstallation();
    const ref = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });

    const treeSha = ref.data.object.sha;
    const treeResponse = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "1"
    });

    const tree = treeResponse.data.tree
      .filter((item): item is { path: string; type: string } =>
        Boolean(item.path && item.type)
      )
      .map((item) => ({
        path: item.path,
        type: item.type
      }));

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        installationId,
        repo: `${owner}/${repo}`,
        branch,
        tree
      }
    };
  } catch (error) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: (error as Error).message
    };
  }
};
