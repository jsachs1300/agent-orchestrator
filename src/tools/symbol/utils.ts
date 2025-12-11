import { escapeForRegex } from "../shared/repo-utils";

export type TreeItem = {
  path: string;
  sha: string;
  size: number | null;
};

const JS_TS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

export function isIndexablePath(path: string): boolean {
  if (path.includes("node_modules/")) return false;
  return JS_TS_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export function prioritizeTree(
  tree: TreeItem[],
  opts: { pathHint?: string; definitionPath?: string } = {}
): TreeItem[] {
  const seen = new Set<string>();
  const prioritized: TreeItem[] = [];

  const filtered = tree.filter((item) => isIndexablePath(item.path));

  if (opts.definitionPath) {
    const match = filtered.find((item) => item.path === opts.definitionPath);
    if (match) {
      prioritized.push(match);
      seen.add(match.path);
    }
  }

  if (opts.pathHint) {
    for (const item of filtered) {
      if (seen.has(item.path)) continue;
      if (
        item.path.startsWith(opts.pathHint) ||
        item.path.includes(opts.pathHint)
      ) {
        prioritized.push(item);
        seen.add(item.path);
      }
    }
  }

  for (const item of filtered) {
    if (seen.has(item.path)) continue;
    prioritized.push(item);
    seen.add(item.path);
  }

  return prioritized;
}

export function buildWordMatcher(symbolName: string): RegExp {
  return new RegExp(`\\b${escapeForRegex(symbolName)}\\b`, "g");
}
