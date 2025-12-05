import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";

export const listBranchesTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const owner = req.params?.owner;
  const repo = req.params?.repo;
  const perPage = req.params?.per_page ?? 100;
  const page = req.params?.page ?? 1;

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
    const response = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: perPage,
      page
    });

    const branches = response.data.map((branch) => ({
      name: branch.name,
      protected: branch.protected
    }));

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        installationId,
        repo: `${owner}/${repo}`,
        branches
      }
    };
  } catch (error: any) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: error?.message || "Failed to list branches"
    };
  }
};
