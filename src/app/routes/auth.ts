import { Router } from "express";
import {
  ensureInstallationTokenForSession,
  setSessionInstallationId,
  verifyStateToken
} from "../../core/github-app";
import { getOrCreateSession } from "../../core/session-store";

const router = Router();

router.get("/github/callback", async (req, res) => {
  const state = (req.query.state as string) || "";
  const installationIdParam = (req.query.installation_id as string) || "";

  if (!state || !installationIdParam) {
    return res.status(400).json({
      error: "missing_params",
      message: "Both 'state' and 'installation_id' are required"
    });
  }

  try {
    const { sessionId } = verifyStateToken(state);
    const installationId = Number(installationIdParam);

    if (!installationId || Number.isNaN(installationId)) {
      return res.status(400).json({
        error: "invalid_installation",
        message: "installation_id must be a number"
      });
    }

    const session = await getOrCreateSession(sessionId);
    await setSessionInstallationId(session, installationId);
    const updated = await ensureInstallationTokenForSession(session);

    return res.json({
      sessionId: session.id,
      installationId: updated.installationId,
      tokenExpiresAt: updated.installationTokenExpiresAt
    });
  } catch (err) {
    console.error("Error handling GitHub callback", err);
    return res.status(400).json({
      error: "callback_failed",
      message: (err as Error).message
    });
  }
});

export default router;
