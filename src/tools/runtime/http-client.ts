import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { Session, SessionRuntimeConfig } from "../../core/types";

export const DEFAULT_RUNTIME_TIMEOUT_MS = 5000;

export interface RuntimeHttpRequestParams {
  method: string;
  path: string;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
  body?: any;
}

export interface RuntimeHttpResult {
  success: boolean;
  status: number | null;
  headers: Record<string, string>;
  body: string | null;
  isJson: boolean;
  json: any | null;
  error: string | null;
  elapsedMs: number | null;
}

function buildAuthHeaders(runtime: SessionRuntimeConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = runtime.auth;
  if (!auth || auth.type === "none") return headers;

  if (auth.type === "bearer" && auth.bearerToken) {
    headers["authorization"] = `Bearer ${auth.bearerToken}`;
  } else if (auth.type === "apiKey" && auth.apiKeyHeader && auth.apiKeyValue) {
    headers[auth.apiKeyHeader.toLowerCase()] = auth.apiKeyValue;
  } else if (
    auth.type === "basic" &&
    typeof auth.basicUser === "string" &&
    typeof auth.basicPassword === "string"
  ) {
    const credentials = Buffer.from(`${auth.basicUser}:${auth.basicPassword}`).toString("base64");
    headers["authorization"] = `Basic ${credentials}`;
  }

  return headers;
}

function buildUrl(baseUrl: string, path: string, queryParams?: Record<string, string>): URL {
  const url = new URL(path, baseUrl);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (typeof value === "undefined") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function mergeHeaders(
  base: Record<string, string>,
  override?: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...base };
  if (!override) return merged;
  for (const [key, value] of Object.entries(override)) {
    merged[key.toLowerCase()] = value;
  }
  return merged;
}

export async function performRuntimeHttpRequest(
  session: Session,
  params: RuntimeHttpRequestParams
): Promise<RuntimeHttpResult> {
  const runtime = session.runtime;
  if (!runtime || !runtime.enabled || !runtime.baseUrl) {
    return {
      success: false,
      status: null,
      headers: {},
      body: null,
      isJson: false,
      json: null,
      error: "runtime_not_configured",
      elapsedMs: null
    };
  }

  const headers = mergeHeaders(buildAuthHeaders(runtime), params.headers);
  const timeoutMs = runtime.timeoutMs ?? DEFAULT_RUNTIME_TIMEOUT_MS;
  const url = buildUrl(runtime.baseUrl, params.path, params.queryParams);

  const init: RequestInit = {
    method: params.method,
    headers,
  };

  if (typeof params.body !== "undefined") {
    if (!init.headers || !("content-type" in (init.headers as Record<string, string>))) {
      headers["content-type"] = "application/json";
    }
    init.body = JSON.stringify(params.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;

  const start = Date.now();
  try {
    const resp = await fetch(url, init);
    const elapsedMs = Date.now() - start;
    clearTimeout(timeout);

    const responseHeaders: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const bodyText = await resp.text();
    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    let json: any = null;

    if (isJson) {
      try {
        json = JSON.parse(bodyText || "null");
      } catch {
        json = null;
      }
    }

    return {
      success: true,
      status: resp.status,
      headers: responseHeaders,
      body: bodyText,
      isJson,
      json,
      error: null,
      elapsedMs
    };
  } catch (err) {
    clearTimeout(timeout);
    const elapsedMs = Date.now() - start;
    const error = err instanceof Error ? err.name === "AbortError" ? "timeout" : err.message : "unknown_error";
    return {
      success: false,
      status: null,
      headers: {},
      body: null,
      isJson: false,
      json: null,
      error,
      elapsedMs
    };
  }
}
