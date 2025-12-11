import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sessionsRouter from "./routes/sessions";
import authRouter from "./routes/auth";
import toolsRouter from "./routes/tools";
import { initRedisClient } from "../core/redis-client";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "agent-orchestrator" });
  });

  app.use("/sessions", sessionsRouter);
  app.use("/auth", authRouter);
  app.use("/tools", toolsRouter);

  initRedisClient();

  return app;
}

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`agent-orchestrator listening on http://localhost:${PORT}`);
  });
}
