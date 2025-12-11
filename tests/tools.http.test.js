const test = require("node:test");
const assert = require("node:assert");

const { createApp } = require("../dist/app");
const { createSession } = require("../dist/core/session-store");

function startServer(octokit) {
  const app = createApp();
  app.locals.toolGithubFactory = () => ({
    requireInstallation: async () => ({
      installationId: 1,
      octokit
    })
  });

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "string" ? 0 : address.port;
  return { server, port };
}

test("POST /tools/repo/search executes the tool", async () => {
  const blobContent = Buffer.from("find me", "utf8").toString("base64");

  const octokit = {
    git: {
      getRef: async () => ({ data: { object: { sha: "root" } } }),
      getTree: async () => ({
        data: {
          tree: [{ path: "src/index.ts", type: "blob", sha: "file-sha", size: 10 }]
        }
      }),
      getBlob: async () => ({ data: { content: blobContent, encoding: "base64" } })
    }
  };

  await createSession({ id: "http-session", metadata: {}, tools: [] });

  const { server, port } = startServer(octokit);
  const response = await fetch(`http://127.0.0.1:${port}/tools/repo/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: "http-session",
      owner: "octo",
      repo: "demo",
      query: "find"
    })
  });

  const body = await response.json();
  server.close();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.result.results.length, 1);
});

test("POST /tools/symbol/find-definition validates input", async () => {
  await createSession({ id: "http-symbol-session", metadata: {}, tools: [] });

  const { server, port } = startServer({
    git: {
      getRef: async () => ({ data: { object: { sha: "root" } } }),
      getTree: async () => ({ data: { tree: [] } })
    }
  });

  const response = await fetch(
    `http://127.0.0.1:${port}/tools/symbol/find-definition`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: "http-symbol-session" })
    }
  );

  const body = await response.json();
  server.close();

  assert.equal(response.status, 400);
  assert.equal(body.error, "symbolName is required");
});
