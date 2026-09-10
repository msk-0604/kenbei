import "server-only";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { buildStructuredLog, type RequestLogContext } from "@/lib/observability";

async function requestContext(explicit: RequestLogContext = {}): Promise<RequestLogContext> {
  let requestId = explicit.requestId;
  if (!requestId) {
    try {
      requestId = (await headers()).get("x-request-id") ?? undefined;
    } catch {
      requestId = undefined;
    }
  }
  return {
    requestId,
    organizationId: explicit.organizationId,
    userId: explicit.userId,
  };
}

function emit(level: "info" | "warn" | "error", message: string, context: RequestLogContext, extra: Record<string, unknown>) {
  const payload = buildStructuredLog(level, message, context, extra);
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
  Sentry.withScope((scope) => {
    if (context.requestId) {
      scope.setTag("request_id", context.requestId);
    }
    if (context.organizationId) {
      scope.setTag("organization_id", context.organizationId);
    }
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }
    if (level === "error") {
      Sentry.captureMessage(message, "error");
    }
  });
}

export async function logServerInfo(message: string, extra: Record<string, unknown> = {}, context: RequestLogContext = {}) {
  emit("info", message, await requestContext(context), extra);
}

export async function logServerWarn(message: string, extra: Record<string, unknown> = {}, context: RequestLogContext = {}) {
  emit("warn", message, await requestContext(context), extra);
}

export async function logServerError(message: string, extra: Record<string, unknown> = {}, context: RequestLogContext = {}) {
  emit("error", message, await requestContext(context), extra);
}

export function bindSentryWorkspace(workspace: { userId?: string; organizationId?: string } | null) {
  const scope = Sentry.getIsolationScope();
  if (workspace?.userId) {
    scope.setUser({ id: workspace.userId });
  } else {
    scope.setUser(null);
  }
  if (workspace?.organizationId) {
    scope.setTag("organization_id", workspace.organizationId);
  } else {
    scope.setTag("organization_id", "");
  }
}
