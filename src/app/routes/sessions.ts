import { Router } from "express";
import { getOrCreateSession } from "../../core/session-store";
import { runOrchestrationTurn } from "../../core/orchestrator";

const router = Router();

/**
 * POST /sessions/:id/message
 * body: { text: string }
 */
router.post("/:id/message", async (req, res) => {
  const sessionId = req.params.id;
  const text = (req.body && req.body.text) || "";

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const session = getOrCreateSession(sessionId);
    const userMessages = await runOrchestrationTurn(session, text);

    res.json({
      sessionId,
      messages: userMessages
    });
  } catch (err) {
    console.error("Error in POST /sessions/:id/message", err);
    res.status(500).json({
      error: "internal_error",
      message: (err as Error).message
    });
  }
});

export default router;
