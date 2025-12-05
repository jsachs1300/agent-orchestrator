import { createAppAuth } from "@octokit/auth-app";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Session } from "./types";
import { saveSession } from "./session-store";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

type SessionGithubMetadata = {
  installationId: number;
  installationToken?: string;
  installationTokenExpiresAt?: string;
};

function getAppId(): number {
  const raw = process.env.GITHUB_APP_ID;
  if (!raw) {
    throw new Error("GITHUB_APP_ID is not configured");
  }
  const appId = Number(raw);
  if (Number.isNaN(appId)) {
    throw new Error("GITHUB_APP_ID must be a number");
  }
  return appId;
}

function getClientId(): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID is not configured");
  }
  return clientId;
}

function getClientSecret(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret) {
    throw new Error("GITHUB_CLIENT_SECRET is not configured");
  }
  return secret;
}

function getPrivateKey(): string {
  const key = process.env.GITHUB_PRIVATE_KEY;
  if (!key) {
    throw new Error("GITHUB_PRIVATE_KEY is not configured");
  }
  return key.replace(/\\n/g, "\n");
}

function getAppPublicUrl(): string | undefined {
  const url = process.env.APP_PUBLIC_URL;
  return url && url.trim().length > 0 ? url.trim() : undefined;
}

let appInstance: App | null = null;
function getApp(): App {
  if (!appInstance) {
    appInstance = new App({
      appId: getAppId(),
      privateKey: getPrivateKey(),
      oauth: {
        clientId: getClientId(),
        clientSecret: getClientSecret()
      }
    });
  }
  return appInstance;
}

export async function verifyAppJwt(): Promise<string> {
  const auth = createAppAuth({
    appId: getAppId(),
    privateKey: getPrivateKey(),
    clientId: getClientId(),
    clientSecret: getClientSecret()
  });

  const { token } = await auth({ type: "app" });
  return token;
}

export async function generateInstallationToken(
  installationId: number
): Promise<{ token: string; expiresAt: string }> {
  const auth = createAppAuth({
    appId: getAppId(),
    privateKey: getPrivateKey(),
    clientId: getClientId(),
    clientSecret: getClientSecret()
  });

  const { token, expiresAt } = await auth({
    type: "installation",
    installationId
  });

  return { token, expiresAt };
}

export function signStateToken(sessionId: string): string {
  const secret = getClientSecret();
  const appUrl = getAppPublicUrl();
  return jwt.sign({ sessionId, appUrl }, secret, { expiresIn: "10m" });
}

export function verifyStateToken(token: string): { sessionId: string } {
  const secret = getClientSecret();
  const decoded = jwt.verify(token, secret) as JwtPayload;
  if (!decoded || typeof decoded !== "object" || !decoded.sessionId) {
    throw new Error("Invalid state token");
  }
  const appUrl = getAppPublicUrl();
  if (appUrl && decoded.appUrl && decoded.appUrl !== appUrl) {
    throw new Error("State token was issued for a different redirect origin");
  }
  return { sessionId: decoded.sessionId as string };
}

function getGithubMetadata(session: Session): SessionGithubMetadata | null {
  const raw = session.metadata?.githubInstallation;
  if (!raw) return null;

  const installationId = Number(raw.installationId);
  if (!installationId || Number.isNaN(installationId)) return null;

  return {
    installationId,
    installationToken: raw.installationToken,
    installationTokenExpiresAt: raw.installationTokenExpiresAt
  };
}

function saveGithubMetadata(
  session: Session,
  metadata: SessionGithubMetadata
): SessionGithubMetadata {
  session.metadata.githubInstallation = {
    installationId: metadata.installationId,
    installationToken: metadata.installationToken,
    installationTokenExpiresAt: metadata.installationTokenExpiresAt
  };
  saveSession(session);
  return metadata;
}

export function setSessionInstallationId(
  session: Session,
  installationId: number
): SessionGithubMetadata {
  const metadata: SessionGithubMetadata = {
    installationId,
    installationToken: undefined,
    installationTokenExpiresAt: undefined
  };
  return saveGithubMetadata(session, metadata);
}

export async function ensureInstallationTokenForSession(
  session: Session
): Promise<SessionGithubMetadata> {
  const metadata = getGithubMetadata(session);
  if (!metadata) {
    throw new Error("Session is not linked to a GitHub installation");
  }

  const expiresAt = metadata.installationTokenExpiresAt
    ? new Date(metadata.installationTokenExpiresAt)
    : null;
  const needsRefresh =
    !metadata.installationToken ||
    !expiresAt ||
    expiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return metadata;
  }

  const { token, expiresAt: newExpiry } = await generateInstallationToken(
    metadata.installationId
  );
  metadata.installationToken = token;
  metadata.installationTokenExpiresAt = newExpiry;
  return saveGithubMetadata(session, metadata);
}

export async function getInstallationOctokitForSession(
  session: Session
): Promise<{ octokit: Octokit; installationId: number }> {
  const metadata = await ensureInstallationTokenForSession(session);
  if (!metadata.installationToken) {
    throw new Error("Failed to acquire installation token");
  }
  const octokit = new Octokit({ auth: metadata.installationToken });
  return { octokit, installationId: metadata.installationId };
}
