import express from "express";
import requirementsRouter from "./routes/requirements.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(requirementsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

export default app;
