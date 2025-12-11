import { ToolHandler } from "../index";
import { performRuntimeHttpRequest } from "./http-client";

export const httpRequestTool: ToolHandler = async (req, ctx) => {
  const method = req.params?.method;
  const path = req.params?.path;

  if (!method || typeof method !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'method' parameter is required"
    };
  }

  if (!path || typeof path !== "string") {
    return {
      callId: req.callId,
      name: req.name,
      success: false,
      error: "'path' parameter is required"
    };
  }

  const result = await performRuntimeHttpRequest(ctx.session, {
    method,
    path,
    queryParams: req.params?.queryParams,
    headers: req.params?.headers,
    body: req.params?.body
  });

  return {
    callId: req.callId,
    name: req.name,
    success: result.success,
    result,
    error: result.success ? undefined : result.error ?? "request_failed"
  };
};
