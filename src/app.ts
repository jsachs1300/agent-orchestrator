import express from "express";
import path from "path";
import { appendFile, mkdir, readFile } from "fs/promises";
import requirementsRouter from "./routes/requirements.js";
import { requireIdentity } from "./middleware/auth.js";

const app = express();
const promptsDir = path.join(process.cwd(), "prompts");
const orchestrationSpecPath = path.join(process.cwd(), "ORCHESTRATION_SPEC.md");
const logsDir = path.join(process.cwd(), "logs");
const requestLogPath = path.join(logsDir, "requests.log");
let logDirReady: Promise<void> | null = null;

function ensureLogDir() {
  if (!logDirReady) {
    logDirReady = mkdir(logsDir, { recursive: true }).catch((err) => {
      logDirReady = null;
      console.error("failed to create logs directory", err);
    });
  }
  return logDirReady;
}

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.on("finish", () => {
    const role = req.header("x-agent-role") ?? "-";
    const agentId = req.header("x-agent-id") ?? "-";
    const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} role=${role} agent_id=${agentId}\n`;
    ensureLogDir()
      ?.then(() => appendFile(requestLogPath, line))
      .catch((err) => {
        console.error("failed to write request log", err);
      });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.get("/ORCHESTRATION_SPEC.md", async (_req, res) => {
  try {
    const contents = await readFile(orchestrationSpecPath, "utf-8");
    return res.status(200).type("text/markdown").send(contents);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return res.status(404).json({ error: "spec_not_found" });
    }
    return res.status(500).json({ error: "spec_read_failed" });
  }
});
app.get("/prompt/:name", async (req, res) => {
  const name = String(req.params.name || "").trim();
  if (!/^[a-z0-9_-]+$/i.test(name)) {
    return res.status(400).json({ error: "invalid_prompt_name" });
  }

  const filePath = path.join(promptsDir, `${name}.txt`);
  try {
    const contents = await readFile(filePath, "utf-8");
    return res.status(200).type("text/plain").send(contents);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return res.status(404).json({ error: "prompt_not_found" });
    }
    return res.status(500).json({ error: "prompt_read_failed" });
  }
});
app.use(requireIdentity);
app.use(requirementsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

export default app;
