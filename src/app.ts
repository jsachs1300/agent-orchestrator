import express from "express";
import path from "path";
import { readFile } from "fs/promises";
import requirementsRouter from "./routes/requirements.js";
import { requireIdentity } from "./middleware/auth.js";

const app = express();
const promptsDir = path.join(process.cwd(), "prompts");
const orchestrationSpecPath = path.join(process.cwd(), "ORCHESTRATION_SPEC.md");

app.use(express.json({ limit: "1mb" }));

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
