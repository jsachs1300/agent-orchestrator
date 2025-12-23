import express from "express";
import requirementsRouter from "./routes/requirements.js";
import { requireIdentity } from "./middleware/auth.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(requireIdentity);
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.use(requirementsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

export default app;
