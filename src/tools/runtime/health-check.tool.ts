import { ToolHandler } from "../index";
import { performRuntimeHttpRequest } from "./http-client";

interface HealthCheckResult {
  ok: boolean;
  status: number | null;
  path: string;
  elapsedMs: number | null;
  error?: string;
  details?: Record<string, any>;
}

export const healthCheckTool: ToolHandler = async (req, ctx) => {
  const path =
    typeof req.params?.path === "string" && req.params.path.length > 0
      ? req.params.path
      : "/health";
  const expectedStatus = (() => {
    const raw = req.params?.expectedStatus;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 200;
  })();

  const runtimeResult = await performRuntimeHttpRequest(ctx.session, {
    method: "GET",
    path,
    queryParams: undefined,
    headers: undefined
  });

  if (runtimeResult.error === "runtime_not_configured") {
    const result: HealthCheckResult = {
      ok: false,
      status: null,
      path,
      elapsedMs: null,
      error: "runtime_not_configured",
      details: { originalError: runtimeResult.error }
    };
    return { callId: req.callId, name: req.name, success: false, result, error: runtimeResult.error };
  }

  if (!runtimeResult.success) {
    const result: HealthCheckResult = {
      ok: false,
      status: null,
      path,
      elapsedMs: runtimeResult.elapsedMs,
      error: runtimeResult.error ?? "network_error",
      details: { originalError: runtimeResult.error }
    };

    return {
      callId: req.callId,
      name: req.name,
      success: false,
      result,
      error: runtimeResult.error ?? "network_error"
    };
  }

  const ok = runtimeResult.status === expectedStatus;
  const result: HealthCheckResult = {
    ok,
    status: runtimeResult.status,
    path,
    elapsedMs: runtimeResult.elapsedMs,
    details: {
      status: runtimeResult.status,
      body: runtimeResult.body,
      isJson: runtimeResult.isJson,
      json: runtimeResult.json
    }
  };

  return {
    callId: req.callId,
    name: req.name,
    success: ok,
    result,
    error: ok ? undefined : "unexpected_status"
  };
};
