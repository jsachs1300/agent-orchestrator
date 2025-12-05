const test = require("node:test");
const assert = require("node:assert");

const {
  listBranchesTool
} = require("../dist/tools/repo/list-branches.tool");
const { readTreeTool } = require("../dist/tools/repo/read-tree.tool");
const { readFileTool } = require("../dist/tools/repo/read-file.tool");
const { createBranchTool } = require("../dist/tools/repo/create-branch.tool");
const { writeFileTool } = require("../dist/tools/repo/write-file.tool");

const OWNER = "jsachs1300";
const REPO = "agent-orchestrator";

function makeCtx(octokit) {
  return {
    github: {
      requireInstallation: async () => ({
        installationId: 123,
        octokit
      })
    }
  };
}

test("repo.list_branches returns branch metadata", async () => {
  let called = false;
  const octokit = {
    repos: {
      listBranches: async ({ owner, repo, per_page, page }) => {
        called = true;
        assert.equal(owner, OWNER);
        assert.equal(repo, REPO);
        assert.equal(per_page, 50);
        assert.equal(page, 2);
        return {
          data: [
            { name: "main", protected: true },
            { name: "dev", protected: false }
          ]
        };
      }
    }
  };

  const res = await listBranchesTool(
    {
      callId: "1",
      name: "repo.list_branches",
      params: { owner: OWNER, repo: REPO, per_page: 50, page: 2 }
    },
    makeCtx(octokit)
  );

  assert.ok(called, "should call listBranches");
  assert.equal(res.success, true);
  assert.deepStrictEqual(res.result.branches, [
    { name: "main", protected: true },
    { name: "dev", protected: false }
  ]);
});

test("repo.read_tree lists files for a branch", async () => {
  let getRefCalled = false;
  let getTreeCalled = false;

  const octokit = {
    git: {
      getRef: async ({ owner, repo, ref }) => {
        getRefCalled = true;
        assert.equal(owner, OWNER);
        assert.equal(repo, REPO);
        assert.equal(ref, "heads/main");
        return { data: { object: { sha: "base-sha" } } };
      },
      getTree: async ({ owner, repo, tree_sha, recursive }) => {
        getTreeCalled = true;
        assert.equal(owner, OWNER);
        assert.equal(repo, REPO);
        assert.equal(tree_sha, "base-sha");
        assert.equal(recursive, "1");
        return {
          data: {
            tree: [
              { path: "README.md", type: "blob" },
              { path: "src", type: "tree" }
            ]
          }
        };
      }
    }
  };

  const res = await readTreeTool(
    {
      callId: "2",
      name: "repo.read_tree",
      params: { owner: OWNER, repo: REPO, branch: "main" }
    },
    makeCtx(octokit)
  );

  assert.ok(getRefCalled, "should fetch branch ref");
  assert.ok(getTreeCalled, "should fetch tree");
  assert.equal(res.success, true);
  assert.deepStrictEqual(res.result.tree, [
    { path: "README.md", type: "blob" },
    { path: "src", type: "tree" }
  ]);
});

test("repo.read_file decodes file content", async () => {
  let called = false;
  const sampleContent = "console.log('hello');";

  const octokit = {
    repos: {
      getContent: async ({ owner, repo, path, ref }) => {
        called = true;
        assert.equal(owner, OWNER);
        assert.equal(repo, REPO);
        assert.equal(path, "src/index.ts");
        assert.equal(ref, "main");
        return {
          data: {
            content: Buffer.from(sampleContent, "utf8").toString("base64"),
            encoding: "base64"
          }
        };
      }
    }
  };

  const res = await readFileTool(
    {
      callId: "3",
      name: "repo.read_file",
      params: { owner: OWNER, repo: REPO, path: "src/index.ts", branch: "main" }
    },
    makeCtx(octokit)
  );

  assert.ok(called, "should call getContent");
  assert.equal(res.success, true);
  assert.equal(res.result.content, sampleContent);
});

test("repo.create_branch uses source ref and reports base sha", async () => {
  let refCall = null;
  let createCall = null;

  const octokit = {
    git: {
      getRef: async (params) => {
        refCall = params;
        return { data: { object: { sha: "abc123" } } };
      },
      createRef: async (params) => {
        createCall = params;
        return { data: {} };
      }
    }
  };

  const res = await createBranchTool(
    {
      callId: "4",
      name: "repo.create_branch",
      params: {
        owner: OWNER,
        repo: REPO,
        branch: "feature/tests",
        from: "main"
      }
    },
    makeCtx(octokit)
  );

  assert.deepStrictEqual(refCall, {
    owner: OWNER,
    repo: REPO,
    ref: "heads/main"
  });
  assert.deepStrictEqual(createCall, {
    owner: OWNER,
    repo: REPO,
    ref: "refs/heads/feature/tests",
    sha: "abc123"
  });
  assert.equal(res.success, true);
  assert.equal(res.result.branch, "feature/tests");
  assert.equal(res.result.baseSha, "abc123");
});

test("repo.write_file updates content with base64 encoding", async () => {
  let getContentCall = null;
  let createOrUpdateCall = null;

  const octokit = {
    repos: {
      getContent: async (params) => {
        getContentCall = params;
        return { data: { sha: "existing-sha", content: "", encoding: "base64" } };
      },
      createOrUpdateFileContents: async (params) => {
        createOrUpdateCall = params;
        return {
          data: {
            commit: { sha: "new-commit-sha" },
            content: { sha: "new-blob-sha" }
          }
        };
      }
    }
  };

  const res = await writeFileTool(
    {
      callId: "5",
      name: "repo.write_file",
      params: {
        owner: OWNER,
        repo: REPO,
        path: "README.md",
        content: "Updated readme content",
        branch: "main",
        message: "doc: update README"
      }
    },
    makeCtx(octokit)
  );

  assert.deepStrictEqual(getContentCall, {
    owner: OWNER,
    repo: REPO,
    path: "README.md",
    ref: "main"
  });

  assert.ok(createOrUpdateCall, "should attempt to write via GitHub API");
  assert.equal(createOrUpdateCall.owner, OWNER);
  assert.equal(createOrUpdateCall.repo, REPO);
  assert.equal(createOrUpdateCall.path, "README.md");
  assert.equal(createOrUpdateCall.branch, "main");
  assert.equal(createOrUpdateCall.message, "doc: update README");

  const decoded = Buffer.from(createOrUpdateCall.content, "base64").toString(
    "utf8"
  );
  assert.equal(decoded, "Updated readme content");

  assert.equal(res.success, true);
  assert.equal(res.result.commit, "new-commit-sha");
  assert.equal(res.result.blob, "new-blob-sha");
});
