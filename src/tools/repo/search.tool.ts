import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";
import {
  buildSnippet,
  fetchRepoTree,
  getTextBlob,
  matchesPathFilters,
  resolveRepoTarget
} from "../shared/repo-utils";

const DEFAULT_MAX_RESULTS = 50;
const MAX_FILES_SCANNED = 500;

export const searchRepoTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const query = req.params?.query;
  const paths = Array.isArray(req.params?.paths)
    ? (req.params.paths as Array<string>)
    : undefined;
  const maxResults = (() => {
    const raw = req.params?.maxResults;
    if (typeof raw === "number" && raw > 0) return raw;
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_MAX_RESULTS;
  })();

  if (!query || typeof query !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'query' parameter is required"
    };
  }

  const target = resolveRepoTarget(ctx.session, req.params, req.name);
  if (!target) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "Repository owner and name must be configured in params or session metadata"
    };
  }

  try {
    const { octokit, installationId } = await ctx.github.requireInstallation();
    const tree = await fetchRepoTree(octokit, target);

    const filteredTree = tree
      .filter((item) => matchesPathFilters(item.path, paths))
      .slice(0, MAX_FILES_SCANNED);

    const results: Array<{
      path: string;
      line: number;
      column: number;
      snippet: string;
    }> = [];

    let hitResultLimit = false;

    for (const item of filteredTree) {
      if (results.length >= maxResults) break;

      const content = await getTextBlob(octokit, target, item.sha);
      if (!content) continue;

      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const line = lines[i];
        let searchIndex = 0;
        let foundAt = line.indexOf(query, searchIndex);

        while (foundAt !== -1 && results.length < maxResults) {
          results.push({
            path: item.path,
            line: i + 1,
            column: foundAt + 1,
            snippet: buildSnippet(lines, i)
          });
          searchIndex = foundAt + query.length;
          foundAt = line.indexOf(query, searchIndex);
        }

        if (results.length >= maxResults) {
          hitResultLimit = true;
          break;
        }
      }
    }

    const truncated = hitResultLimit || tree.length > filteredTree.length;

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        installationId,
        repo: `${target.owner}/${target.repo}`,
        branch: target.branch,
        results,
        truncated
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

