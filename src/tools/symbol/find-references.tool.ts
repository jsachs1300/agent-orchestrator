import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";
import {
  buildSnippet,
  fetchRepoTree,
  getTextBlob,
  resolveRepoTarget
} from "../shared/repo-utils";
import { buildWordMatcher, prioritizeTree } from "./utils";

const DEFAULT_MAX_RESULTS = 50;
const MAX_FILES_SCANNED = 500;

function findReferenceMatches(
  lines: string[],
  matcher: RegExp,
  path: string,
  remaining: number
): Array<{ path: string; line: number; column: number; snippet: string }> {
  const matches: Array<{ path: string; line: number; column: number; snippet: string }> = [];

  for (let i = 0; i < lines.length && matches.length < remaining; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(line)) && matches.length < remaining) {
      if (typeof match.index === "number") {
        matches.push({
          path,
          line: i + 1,
          column: match.index + 1,
          snippet: buildSnippet(lines, i)
        });
      }
    }
    matcher.lastIndex = 0;
  }

  return matches;
}

export const findReferencesTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const symbol = (req.params?.symbolName ?? req.params?.symbol) as string | undefined;
  const definitionPath =
    typeof req.params?.definitionPath === "string" ? req.params.definitionPath : undefined;
  const pathHint = typeof req.params?.pathHint === "string" ? req.params.pathHint : undefined;
  const maxResults = (() => {
    const raw = req.params?.maxResults;
    if (typeof raw === "number" && raw > 0) return raw;
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_MAX_RESULTS;
  })();

  if (!symbol || typeof symbol !== "string" || symbol.trim().length === 0) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'symbolName' parameter is required"
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
    const { octokit } = await ctx.github.requireInstallation();
    const tree = await fetchRepoTree(octokit, target);

    const candidates = prioritizeTree(tree, { pathHint, definitionPath }).slice(
      0,
      MAX_FILES_SCANNED
    );

    const matcher = buildWordMatcher(symbol);
    const references: Array<{ path: string; line: number; column: number; snippet: string }> = [];
    let truncated = false;

    for (const item of candidates) {
      if (references.length >= maxResults) break;

      const content = await getTextBlob(octokit, target, item.sha);
      if (!content) continue;

      const lines = content.split(/\r?\n/);
      const matches = findReferenceMatches(
        lines,
        matcher,
        item.path,
        maxResults - references.length
      );
      references.push(...matches);

      if (references.length >= maxResults) {
        truncated = true;
        break;
      }
    }

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        references,
        approximate: true,
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

