const test = require("node:test");
const assert = require("node:assert");

const { searchRepoTool } = require("../dist/tools/repo/search.tool");
const { findDefinitionTool } = require("../dist/tools/symbol/find-definition.tool");
const { findReferencesTool } = require("../dist/tools/symbol/find-references.tool");

const OWNER = "octo";
const REPO = "demo";

function makeSession() {
  const now = new Date().toISOString();
  return {
    id: "session-1",
    goal: null,
    metadata: {},
    context: {},
    tools: {},
    threads: {},
    debugLog: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeCtx(octokit) {
  return {
    session: makeSession(),
    github: {
      requireInstallation: async () => ({
        installationId: 999,
        octokit
      })
    }
  };
}

test("repo.search scans repo files and returns snippets", async () => {
  const blobs = {
    alpha: Buffer.from("hello world\nsecond line", "utf8").toString("base64"),
    beta: Buffer.from("no match here", "utf8").toString("base64")
  };

  let refCalled = false;
  let treeCalled = false;
  let blobReads = 0;

  const octokit = {
    git: {
      getRef: async ({ owner, repo, ref }) => {
        refCalled = true;
        assert.equal(owner, OWNER);
        assert.equal(repo, REPO);
        assert.equal(ref, "heads/main");
        return { data: { object: { sha: "root" } } };
      },
      getTree: async ({ owner, repo, tree_sha, recursive }) => {
        treeCalled = true;
        assert.equal(owner, OWNER);
        assert.equal(repo, REPO);
        assert.equal(tree_sha, "root");
        assert.equal(recursive, "1");
        return {
          data: {
            tree: [
              { path: "src/a.ts", type: "blob", sha: "alpha", size: 20 },
              { path: "README.md", type: "blob", sha: "beta", size: 20 }
            ]
          }
        };
      },
      getBlob: async ({ file_sha }) => {
        blobReads++;
        return { data: { content: blobs[file_sha], encoding: "base64" } };
      }
    }
  };

  const res = await searchRepoTool(
    {
      callId: "search-1",
      name: "repo.search",
      params: { owner: OWNER, repo: REPO, query: "hello", maxResults: 1 }
    },
    makeCtx(octokit)
  );

  assert.ok(refCalled, "should fetch branch ref");
  assert.ok(treeCalled, "should fetch tree for search");
  assert.ok(blobReads > 0, "should read blobs");
  assert.equal(res.success, true);
  assert.equal(res.result.repo, `${OWNER}/${REPO}`);
  assert.equal(res.result.results.length, 1);
  assert.equal(res.result.results[0].line, 1);
  assert.equal(res.result.results[0].column, 1);
  assert.equal(res.result.truncated, true);
});

test("symbol.find_definition locates probable declarations", async () => {
  const blobContent = [
    "export async function greet() {",
    "  return 'hi';",
    "}",
    "class Greeter {}",
    "const greet = () => greet();"
  ].join("\n");

  const octokit = {
    git: {
      getRef: async () => ({ data: { object: { sha: "root" } } }),
      getTree: async () => ({
        data: {
          tree: [{ path: "src/greetings.ts", type: "blob", sha: "greet-sha", size: 50 }]
        }
      }),
      getBlob: async () => ({
        data: { content: Buffer.from(blobContent, "utf8").toString("base64"), encoding: "base64" }
      })
    }
  };

  const res = await findDefinitionTool(
    {
      callId: "def-1",
      name: "symbol.find_definition",
      params: { owner: OWNER, repo: REPO, symbolName: "greet", maxResults: 5 }
    },
    makeCtx(octokit)
  );

  assert.equal(res.success, true);
  assert.equal(res.result.definition.path, "src/greetings.ts");
  assert.equal(res.result.definition.line, 1);
  assert.equal(res.result.approximate, true);
});

test("symbol.find_references returns occurrences with context", async () => {
  const blobContent = [
    "import { greet } from './lib';",
    "const value = greet('a');",
    "function wrapper() {",
    "  return greet();",
    "}"
  ].join("\n");

  const octokit = {
    git: {
      getRef: async () => ({ data: { object: { sha: "root" } } }),
      getTree: async () => ({
        data: {
          tree: [{ path: "src/refs.ts", type: "blob", sha: "refs-sha", size: 50 }]
        }
      }),
      getBlob: async () => ({
        data: { content: Buffer.from(blobContent, "utf8").toString("base64"), encoding: "base64" }
      })
    }
  };

  const res = await findReferencesTool(
    {
      callId: "ref-1",
      name: "symbol.find_references",
      params: { owner: OWNER, repo: REPO, symbolName: "greet" }
    },
    makeCtx(octokit)
  );

  assert.equal(res.success, true);
  assert.ok(res.result.references.length >= 3, "should find multiple references");
  assert.equal(res.result.truncated, false);
  assert.equal(res.result.references[0].path, "src/refs.ts");
  assert.equal(res.result.approximate, true);
});

test("repo.search returns multiple matches", async () => {
  const blobs = {
    alpha: Buffer.from("hello world\nsecond hello", "utf8").toString("base64"),
    beta: Buffer.from("hello again", "utf8").toString("base64")
  };

  const octokit = {
    git: {
      getRef: async () => ({ data: { object: { sha: "root" } } }),
      getTree: async () => ({
        data: {
          tree: [
            { path: "src/a.ts", type: "blob", sha: "alpha", size: 20 },
            { path: "src/b.ts", type: "blob", sha: "beta", size: 20 }
          ]
        }
      }),
      getBlob: async ({ file_sha }) => ({
        data: { content: blobs[file_sha], encoding: "base64" }
      })
    }
  };

  const res = await searchRepoTool(
    {
      callId: "search-2",
      name: "repo.search",
      params: { owner: OWNER, repo: REPO, query: "hello" }
    },
    makeCtx(octokit)
  );

  assert.equal(res.success, true);
  assert.equal(res.result.results.length, 3);
});

