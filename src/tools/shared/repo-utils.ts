import { Octokit } from "@octokit/rest";
import { Session } from "../../core/types";

export type RepoTarget = {
  owner: string;
  repo: string;
  branch: string;
};

const DEFAULT_BRANCH = "main";
const MAX_FILE_BYTES = 200_000;

function pickString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

export function resolveRepoTarget(
  session: Session | undefined,
  params: any,
  toolName?: string
): RepoTarget | null {
  const toolConfig = toolName ? session?.tools?.[toolName]?.config ?? {} : {};
  const metadataRepo = (session?.metadata as any)?.repo;
  const metadataRepository = (session?.metadata as any)?.repository;
  const metadataGithubRepo = (session?.metadata as any)?.githubRepo;

  const owner = pickString(
    params?.owner,
    toolConfig?.owner,
    metadataRepo?.owner,
    metadataRepo?.ownerName,
    metadataRepository?.owner,
    metadataRepository?.ownerName,
    metadataGithubRepo?.owner,
    (session?.metadata as any)?.owner
  );

  const repo = pickString(
    params?.repo,
    toolConfig?.repo,
    metadataRepo?.repo,
    metadataRepo?.name,
    metadataRepository?.repo,
    metadataRepository?.name,
    metadataGithubRepo?.repo,
    (session?.metadata as any)?.repoName
  );

  const branch =
    pickString(
      params?.branch,
      toolConfig?.branch,
      metadataRepo?.branch,
      metadataRepository?.branch,
      metadataGithubRepo?.branch
    ) ?? DEFAULT_BRANCH;

  if (!owner || !repo) return null;

  return { owner, repo, branch };
}

export async function fetchRepoTree(
  octokit: Octokit,
  target: RepoTarget
): Promise<
  Array<{
    path: string;
    sha: string;
    size: number | null;
  }>
> {
  const ref = await octokit.git.getRef({
    owner: target.owner,
    repo: target.repo,
    ref: `heads/${target.branch}`
  });

  const treeSha = (ref.data.object as any).sha as string;

  const treeResponse = await octokit.git.getTree({
    owner: target.owner,
    repo: target.repo,
    tree_sha: treeSha,
    recursive: "1"
  });

  const items = treeResponse.data.tree as Array<{
    path?: string | null;
    type?: string | null;
    sha?: string | null;
    size?: number | null;
  }>;

  return items
    .filter((item) => item.path && item.type === "blob" && item.sha)
    .map((item) => ({
      path: item.path as string,
      sha: item.sha as string,
      size: typeof item.size === "number" ? item.size : null
    }));
}

function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, 8000);
  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 7 || (byte > 13 && byte < 32)) {
      suspicious++;
    }
  }

  return suspicious / sample.length > 0.3;
}

export async function getTextBlob(
  octokit: Octokit,
  target: RepoTarget,
  sha: string
): Promise<string | null> {
  const blob = await octokit.git.getBlob({
    owner: target.owner,
    repo: target.repo,
    file_sha: sha
  });

  const encoding = (blob.data as any).encoding || "base64";
  const buffer = Buffer.from((blob.data as any).content, encoding);

  if (buffer.length > MAX_FILE_BYTES) return null;
  if (isProbablyBinary(buffer)) return null;

  return buffer.toString("utf8");
}

export function matchesPathFilters(
  path: string,
  paths?: Array<string>
): boolean {
  if (!paths || paths.length === 0) return true;
  return paths.some((prefix) => typeof prefix === "string" && path.startsWith(prefix));
}

export function buildSnippet(
  lines: string[],
  lineIndex: number,
  contextLines = 2
): string {
  const start = Math.max(0, lineIndex - contextLines);
  const end = Math.min(lines.length, lineIndex + contextLines + 1);
  return lines.slice(start, end).join("\n");
}

export function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { MAX_FILE_BYTES };
