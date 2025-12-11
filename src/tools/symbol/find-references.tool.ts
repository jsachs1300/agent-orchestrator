import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";
import {
  buildSnippet,
  escapeForRegex,
  fetchRepoTree,
  getTextBlob,
  matchesPathFilters,
  resolveRepoTarget
} from "../shared/repo-utils";

const DEFAULT_MAX_RESULTS = 50;
const MAX_FILES_SCANNED = 500;

function findReferenceMatches(
  lines: string[],
  symbol: string,
  path: string,
  remaining: number
): Array<{ path: string; line: number; column: number; snippet: string }> {
  const wordPattern = new RegExp(`\\b${escapeForRegex(symbol)}\\b`, "g");
  const matches: Array<{ path: string; line: number; column: number; snippet: string }> = [];

  for (let i = 0; i < lines.length && matches.length < remaining; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(line)) && matches.length < remaining) {
      if (typeof match.index === "number") {
        matches.push({
          path,
          line: i + 1,
          column: match.index + 1,
          snippet: buildSnippet(lines, i)
        });
      }
    }
  }

  return matches;
}

export const findReferencesTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const symbol = req.params?.symbol;
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

  if (!symbol || typeof symbol !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'symbol' parameter is required"
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

    const filtered = tree
      .filter((item) => matchesPathFilters(item.path, paths))
      .filter((item) => !item.path.includes("node_modules/"))
      .slice(0, MAX_FILES_SCANNED);

    const results: Array<{
      path: string;
      line: number;
      column: number;
      snippet: string;
    }> = [];

    let hitResultLimit = false;

    for (const item of filtered) {
      if (results.length >= maxResults) break;

      const content = await getTextBlob(octokit, target, item.sha);
      if (!content) continue;

      const lines = content.split(/\r?\n/);
      const matches = findReferenceMatches(
        lines,
        symbol,
        item.path,
        maxResults - results.length
      );

      results.push(...matches);

      if (results.length >= maxResults) {
        hitResultLimit = true;
        break;
      }
    }

    const truncated = hitResultLimit || tree.length > filtered.length;

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

