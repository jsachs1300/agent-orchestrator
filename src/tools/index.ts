import { Octokit } from "@octokit/rest";
import { ToolRequest, ToolResult, Session } from "../core/types";
import { echoTool } from "./echo.tool";
import { readFileTool } from "./repo/read-file.tool";
import { readTreeTool } from "./repo/read-tree.tool";
import { listBranchesTool } from "./repo/list-branches.tool";
import { createBranchTool } from "./repo/create-branch.tool";
import { writeFileTool } from "./repo/write-file.tool";
import { searchRepoTool } from "./repo/search.tool";
import { findDefinitionTool } from "./symbol/find-definition.tool";
import { findReferencesTool } from "./symbol/find-references.tool";
import { ensureInstallationTokenForSession } from "../core/github-app";
export { TOOL_SCHEMAS } from "./tool-schemas";

export interface ToolExecutionContext {
  session: Session;
  github: {
    requireInstallation: () => Promise<{
      installationId: number;
      octokit: Octokit;
    }>;
  };
}

export type ToolHandler = (
  req: ToolRequest,
  ctx: ToolExecutionContext
) => Promise<ToolResult>;

const registry: Record<string, ToolHandler> = {
  "echo.tool": echoTool,
  "repo.read_tree": readTreeTool,
  "repo.read_file": readFileTool,
  "repo.list_branches": listBranchesTool,
  "repo.create_branch": createBranchTool,
  "repo.write_file": writeFileTool,
  "repo.search": searchRepoTool,
  "symbol.find_definition": findDefinitionTool,
  "symbol.find_references": findReferencesTool
  // "git.apply_changes": gitApplyChangesTool,
};

async function buildContext(
  session: Session,
  overrides?: Partial<ToolExecutionContext>
): Promise<ToolExecutionContext> {
  if (overrides?.github) {
    return { session, github: overrides.github };
  }

  return {
    session,
    github: {
      requireInstallation: async () => {
        const metadata = await ensureInstallationTokenForSession(session);
        if (!metadata.installationToken) {
          throw new Error("Missing installation token after refresh");
        }

        return {
          installationId: metadata.installationId,
          octokit: new Octokit({ auth: metadata.installationToken })
        };
      }
    }
  };
}

export async function dispatchTool(
  req: ToolRequest,
  session: Session,
  overrides?: Partial<ToolExecutionContext>
): Promise<ToolResult> {
  const handler = registry[req.name];
  if (!handler) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: `Unknown tool: ${req.name}`
    };
  }

  try {
    const ctx = await buildContext(session, overrides);
    return await handler(req, ctx);
  } catch (error) {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: (error as Error).message
    };
  }
}
