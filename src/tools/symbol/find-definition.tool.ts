import { ToolHandler } from "../index";
import { ToolRequest, ToolResult } from "../../core/types";
import {
  buildSnippet,
  fetchRepoTree,
  getTextBlob,
  resolveRepoTarget
} from "../shared/repo-utils";
import { buildWordMatcher, prioritizeTree } from "./utils";

const MAX_FILES_SCANNED = 500;

function findDefinition(
  lines: string[],
  symbol: string,
  path: string
): { path: string; line: number; column: number; snippet: string } | null {
  const matcher = buildWordMatcher(symbol);
  const symbolPattern = matcher.source.slice(2, -2);
  const definitionPatterns = [
    /^(export\s+)?async\s+function\s+NAME\b/,
    /^(export\s+)?function\s+NAME\b/,
    /^(export\s+)?class\s+NAME\b/,
    /^(export\s+)?(interface|type|enum)\s+NAME\b/,
    /^(export\s+)?const\s+NAME\b/,
    /^(export\s+)?let\s+NAME\b/,
    /^(export\s+)?var\s+NAME\b/,
    /^(export\s+)?default\s+function\s+NAME\b/
  ].map((pattern) => new RegExp(pattern.source.replace("NAME", symbolPattern)));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of definitionPatterns) {
      const match = line.match(pattern);
      if (match && typeof match.index === "number") {
        return {
          path,
          line: i + 1,
          column: match.index + 1,
          snippet: buildSnippet(lines, i)
        };
      }
    }
  }

  return null;
}

export const findDefinitionTool: ToolHandler = async (
  req: ToolRequest,
  ctx
): Promise<ToolResult> => {
  const symbol = (req.params?.symbolName ?? req.params?.symbol) as string | undefined;
  const pathHint = typeof req.params?.pathHint === "string" ? req.params.pathHint : undefined;

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

    const candidates = prioritizeTree(tree, { pathHint }).slice(0, MAX_FILES_SCANNED);

    let definition: { path: string; line: number; column: number; snippet: string } | null =
      null;

    for (const item of candidates) {
      const content = await getTextBlob(octokit, target, item.sha);
      if (!content) continue;

      const lines = content.split(/\r?\n/);
      const match = findDefinition(lines, symbol, item.path);
      if (match) {
        definition = match;
        break;
      }
    }

    return {
      callId: req.callId,
      name: req.name,
      success: true,
      result: {
        definition,
        approximate: true
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

