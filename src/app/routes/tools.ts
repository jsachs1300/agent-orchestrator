import { Router } from "express";
import { v4 as uuid } from "uuid";
import { dispatchTool, ToolExecutionContext } from "../../tools";
import { findSession } from "../../core/session-store";

const router = Router();

function getGithubOverride(
  req: any
): ToolExecutionContext["github"] | undefined {
  const override = req.app?.locals?.toolGithubFactory;
  if (typeof override === "function") {
    return override(req);
  }
  return undefined;
}

router.post("/repo/search", async (req, res) => {
  if (typeof req.body?.sessionToken !== "string" || req.body.sessionToken.trim().length === 0) {
    return res.status(400).json({ error: "sessionToken is required" });
  }

  const sessionToken = req.body.sessionToken.trim();
  const session = await findSession(sessionToken);
  if (!session) {
    return res.status(404).json({ error: "session_not_found" });
  }

  if (typeof req.body?.query !== "string" || req.body.query.trim().length === 0) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const params = { ...req.body };
    delete params.sessionToken;

    const result = await dispatchTool(
      { callId: uuid(), name: "repo.search", params },
      session,
      { github: getGithubOverride(req) }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Error in POST /tools/repo/search", err);
    res.status(500).json({ error: "internal_error", message: (err as Error).message });
  }
});

router.post("/symbol/find-definition", async (req, res) => {
  if (typeof req.body?.sessionToken !== "string" || req.body.sessionToken.trim().length === 0) {
    return res.status(400).json({ error: "sessionToken is required" });
  }

  const sessionToken = req.body.sessionToken.trim();
  const session = await findSession(sessionToken);
  if (!session) {
    return res.status(404).json({ error: "session_not_found" });
  }

  if (
    typeof req.body?.symbolName !== "string" ||
    req.body.symbolName.trim().length === 0
  ) {
    return res.status(400).json({ error: "symbolName is required" });
  }

  try {
    const params = { ...req.body };
    delete params.sessionToken;

    const result = await dispatchTool(
      { callId: uuid(), name: "symbol.find_definition", params },
      session,
      { github: getGithubOverride(req) }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Error in POST /tools/symbol/find-definition", err);
    res.status(500).json({ error: "internal_error", message: (err as Error).message });
  }
});

router.post("/symbol/find-references", async (req, res) => {
  if (typeof req.body?.sessionToken !== "string" || req.body.sessionToken.trim().length === 0) {
    return res.status(400).json({ error: "sessionToken is required" });
  }

  const sessionToken = req.body.sessionToken.trim();
  const session = await findSession(sessionToken);
  if (!session) {
    return res.status(404).json({ error: "session_not_found" });
  }

  if (
    typeof req.body?.symbolName !== "string" ||
    req.body.symbolName.trim().length === 0
  ) {
    return res.status(400).json({ error: "symbolName is required" });
  }

  try {
    const params = { ...req.body };
    delete params.sessionToken;

    const result = await dispatchTool(
      { callId: uuid(), name: "symbol.find_references", params },
      session,
      { github: getGithubOverride(req) }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Error in POST /tools/symbol/find-references", err);
    res.status(500).json({ error: "internal_error", message: (err as Error).message });
  }
});

router.post("/http/request", async (req, res) => {
  if (typeof req.body?.sessionToken !== "string" || req.body.sessionToken.trim().length === 0) {
    return res.status(400).json({ error: "sessionToken is required" });
  }

  const sessionToken = req.body.sessionToken.trim();
  const session = await findSession(sessionToken);
  if (!session) {
    return res.status(404).json({ error: "session_not_found" });
  }

  try {
    const params = { ...req.body };
    delete params.sessionToken;

    const result = await dispatchTool({ callId: uuid(), name: "http.request", params }, session);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Error in POST /tools/http/request", err);
    res.status(500).json({ error: "internal_error", message: (err as Error).message });
  }
});

router.post("/health/check", async (req, res) => {
  if (typeof req.body?.sessionToken !== "string" || req.body.sessionToken.trim().length === 0) {
    return res.status(400).json({ error: "sessionToken is required" });
  }

  const sessionToken = req.body.sessionToken.trim();
  const session = await findSession(sessionToken);
  if (!session) {
    return res.status(404).json({ error: "session_not_found" });
  }

  try {
    const params = { ...req.body };
    delete params.sessionToken;

    const result = await dispatchTool({ callId: uuid(), name: "health.check", params }, session);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Error in POST /tools/health/check", err);
    res.status(500).json({ error: "internal_error", message: (err as Error).message });
  }
});

export default router;
