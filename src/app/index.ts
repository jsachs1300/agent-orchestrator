import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sessionsRouter from "./routes/sessions";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "agent-orchestrator" });
});

app.use("/sessions", sessionsRouter);

app.listen(PORT, () => {
  console.log(`agent-orchestrator listening on http://localhost:${PORT}`);
});
