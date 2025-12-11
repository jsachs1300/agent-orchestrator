const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

const { createApp } = require("../dist/app");
const { createSession } = require("../dist/core/session-store");

function startApp() {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "string" ? 0 : address.port;
  return { server, port };
}

function startRuntimeServer(handler) {
  const server = http.createServer(handler);
  server.listen(0);
  const address = server.address();
  const port = typeof address === "string" ? 0 : address.port;
  return { server, port };
}

test("sessions API stores runtime configuration", async () => {
  const { server, port } = startApp();

  const runtime = {
    enabled: true,
    baseUrl: "http://example.test",
    timeoutMs: 1500,
    auth: { type: "bearer", bearerToken: "secret" }
  };

  const createResponse = await fetch(`http://127.0.0.1:${port}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "runtime-session", runtime })
  });

  const created = await createResponse.json();
  assert.equal(created.runtime.baseUrl, runtime.baseUrl);
  assert.equal(created.runtime.auth.bearerToken, runtime.auth.bearerToken);

  const getResponse = await fetch(`http://127.0.0.1:${port}/sessions/runtime-session`);
  const fetched = await getResponse.json();
  assert.equal(fetched.runtime.baseUrl, runtime.baseUrl);
  assert.equal(fetched.runtime.auth.type, "bearer");

  server.close();
});

test("http.request returns runtime_not_configured when missing", async () => {
  await createSession({ id: "no-runtime-session", metadata: {}, tools: [] });
  const { server, port } = startApp();

  const response = await fetch(`http://127.0.0.1:${port}/tools/http/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: "no-runtime-session", method: "GET", path: "/" })
  });

  const body = await response.json();
  server.close();

  assert.equal(response.status, 400);
  assert.equal(body.error, "runtime_not_configured");
});

test("http.request forwards responses from the runtime", async () => {
  const runtimeServer = startRuntimeServer((req, res) => {
    if (req.url === "/hello") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "hi" }));
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  await createSession({
    id: "runtime-http-session",
    metadata: {},
    tools: [],
    runtime: {
      enabled: true,
      baseUrl: `http://127.0.0.1:${runtimeServer.port}`,
      timeoutMs: 5000
    }
  });

  const { server, port } = startApp();
  const response = await fetch(`http://127.0.0.1:${port}/tools/http/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: "runtime-http-session",
      method: "GET",
      path: "/hello"
    })
  });

  const body = await response.json();
  server.close();
  runtimeServer.server.close();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.result.status, 200);
  assert.equal(body.result.isJson, true);
  assert.equal(body.result.json.message, "hi");
});

test("http.request reports timeouts", async () => {
  const runtimeServer = startRuntimeServer((_req, res) => {
    setTimeout(() => {
      res.end("slow");
    }, 200);
  });

  await createSession({
    id: "runtime-timeout-session",
    metadata: {},
    tools: [],
    runtime: {
      enabled: true,
      baseUrl: `http://127.0.0.1:${runtimeServer.port}`,
      timeoutMs: 50
    }
  });

  const { server, port } = startApp();
  const response = await fetch(`http://127.0.0.1:${port}/tools/http/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: "runtime-timeout-session",
      method: "GET",
      path: "/"
    })
  });

  const body = await response.json();
  server.close();
  runtimeServer.server.close();

  assert.equal(response.status, 400);
  assert.equal(body.error, "timeout");
  assert.equal(body.result.error, "timeout");
});

test("health.check reports status", async () => {
  const runtimeServer = startRuntimeServer((req, res) => {
    if (req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    } else if (req.url === "/fail") {
      res.statusCode = 503;
      res.end("bad");
    }
  });

  await createSession({
    id: "runtime-health-session",
    metadata: {},
    tools: [],
    runtime: {
      enabled: true,
      baseUrl: `http://127.0.0.1:${runtimeServer.port}`,
      timeoutMs: 500
    }
  });

  const { server, port } = startApp();

  const okResponse = await fetch(`http://127.0.0.1:${port}/tools/health/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: "runtime-health-session" })
  });
  const okBody = await okResponse.json();
  assert.equal(okResponse.status, 200);
  assert.equal(okBody.result.ok, true);
  assert.equal(okBody.result.status, 200);

  const badResponse = await fetch(`http://127.0.0.1:${port}/tools/health/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: "runtime-health-session", path: "/fail", expectedStatus: 200 })
  });
  const badBody = await badResponse.json();

  server.close();
  runtimeServer.server.close();

  assert.equal(badResponse.status, 400);
  assert.equal(badBody.result.ok, false);
  assert.equal(badBody.result.status, 503);
});

test("health.check errors when runtime is missing", async () => {
  await createSession({ id: "health-missing-runtime", metadata: {}, tools: [] });
  const { server, port } = startApp();

  const response = await fetch(`http://127.0.0.1:${port}/tools/health/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: "health-missing-runtime" })
  });

  const body = await response.json();
  server.close();

  assert.equal(response.status, 400);
  assert.equal(body.error, "runtime_not_configured");
});
