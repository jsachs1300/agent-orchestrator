import { Router } from "express";
import {
  createSession,
  getOrCreateSession,
  saveSession,
  setSessionContext,
  setSessionTools
} from "../../core/session-store";
import { runOrchestrationTurn } from "../../core/orchestrator";

interface SessionPayload {
  id?: string;
  goal?: string;
  metadata?: Record<string, any>;
  context?: Record<string, any>;
  tools?: Array<{
    name: string;
    enabled?: boolean;
    config?: Record<string, any>;
    lastUsedAt?: string;
  }>;
}

const router = Router();

/**
 * POST /sessions
 * body: { id?, goal?, metadata?, context?, tools? }
 */
router.post("/", async (req, res) => {
  const body = (req.body ?? {}) as SessionPayload;

  try {
    const session = await createSession({
      id: body.id,
      goal: body.goal,
      metadata: body.metadata,
      context: body.context,
      tools:
        body.tools?.map((tool) => ({
          name: tool.name,
          enabled: tool.enabled ?? true,
          config: tool.config ?? {},
          lastUsedAt: tool.lastUsedAt
        })) ?? []
    });

    res.status(201).json(session);
  } catch (err) {
    console.error("Error in POST /sessions", err);
    res.status(500).json({
      error: "internal_error",
      message: (err as Error).message
    });
  }
});

/**
 * GET /sessions/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const session = await getOrCreateSession(req.params.id);
    res.json(session);
  } catch (err) {
    console.error("Error in GET /sessions/:id", err);
    res.status(500).json({
      error: "internal_error",
      message: (err as Error).message
    });
  }
});

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
    const session = await getOrCreateSession(sessionId);
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

/**
 * PUT /sessions/:id
 * body: { goal?, metadata?, context?, tools? }
 */
router.put("/:id", async (req, res) => {
  const updates = (req.body ?? {}) as SessionPayload;
  try {
    const session = await getOrCreateSession(req.params.id);

    if (typeof updates.goal !== "undefined") {
      session.goal = updates.goal;
    }
    if (updates.metadata) {
      session.metadata = updates.metadata;
    }
    if (updates.context) {
      await setSessionContext(session, updates.context);
    }
    if (updates.tools) {
      await setSessionTools(
        session,
        updates.tools.map((tool) => ({
          name: tool.name,
          enabled: tool.enabled ?? true,
          config: tool.config ?? {},
          lastUsedAt: tool.lastUsedAt
        }))
      );
    }

    await saveSession(session);

    res.json(session);
  } catch (err) {
    console.error("Error in PUT /sessions/:id", err);
    res.status(500).json({
      error: "internal_error",
      message: (err as Error).message
    });
  }
});

export default router;
