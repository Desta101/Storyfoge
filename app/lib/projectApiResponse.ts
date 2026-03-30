import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

const IS_DEV = process.env.NODE_ENV === "development";

export function isPostgrestError(e: unknown): e is PostgrestError {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as PostgrestError).message === "string"
  );
}

/** Full description for logs and the `debug` field in development API responses. */
export function describeProjectServiceError(error: unknown): string {
  if (isPostgrestError(error)) {
    const parts = [
      error.message,
      error.code && `code=${error.code}`,
      error.details && `details=${error.details}`,
      error.hint && `hint=${error.hint}`,
    ].filter(Boolean) as string[];
    return parts.join(" | ");
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export type ProjectApiLogContext = {
  route: string;
  method: string;
  projectId?: string;
  extra?: Record<string, unknown>;
};

export function logProjectApiFailure(
  ctx: ProjectApiLogContext,
  error: unknown,
): void {
  const payload: Record<string, unknown> = {
    route: ctx.route,
    method: ctx.method,
    ...(ctx.projectId ? { projectId: ctx.projectId } : {}),
    ...(ctx.extra ?? {}),
    message: describeProjectServiceError(error),
  };
  if (isPostgrestError(error)) {
    payload.supabase = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    };
  }
  console.error("[project-api]", payload);
}

const FRIENDLY_SAVE =
  "We couldn't save your project. Please try again in a moment.";
const FRIENDLY_LOAD_PROJECTS = "We couldn't load your projects.";
const FRIENDLY_LOAD_ONE = "We couldn't load this project.";
const FRIENDLY_DELETE = "We couldn't delete this project.";
const FRIENDLY_NOT_FOUND = "Project not found.";
const FRIENDLY_SIGN_IN = "You need to sign in to use cloud projects.";
const FRIENDLY_CONFIG =
  "Cloud saves aren't available right now. Please try again later.";

function resolveStatusAndFriendly(
  error: unknown,
  kind: "save" | "loadList" | "loadOne" | "delete",
): { status: number; friendly: string } {
  const msg = error instanceof Error ? error.message : "";

  if (msg === "Unauthorized") {
    return { status: 401, friendly: FRIENDLY_SIGN_IN };
  }
  if (msg === "Supabase is not configured.") {
    return { status: 503, friendly: FRIENDLY_CONFIG };
  }

  if (isPostgrestError(error) && error.code === "PGRST116") {
    return { status: 404, friendly: FRIENDLY_NOT_FOUND };
  }

  switch (kind) {
    case "loadList":
      return { status: 500, friendly: FRIENDLY_LOAD_PROJECTS };
    case "loadOne":
      return { status: 500, friendly: FRIENDLY_LOAD_ONE };
    case "delete":
      return { status: 500, friendly: FRIENDLY_DELETE };
    default:
      return { status: 500, friendly: FRIENDLY_SAVE };
  }
}

type ProjectApiErrorBody = {
  error: string;
  /** Present only in development — full Supabase / service reason for debugging. */
  debug?: string;
};

export function projectApiErrorResponse(
  ctx: ProjectApiLogContext,
  error: unknown,
  kind: "save" | "loadList" | "loadOne" | "delete" = "save",
): NextResponse<ProjectApiErrorBody> {
  logProjectApiFailure(ctx, error);

  const { status, friendly } = resolveStatusAndFriendly(error, kind);
  const body: ProjectApiErrorBody = { error: friendly };
  if (IS_DEV) {
    body.debug = describeProjectServiceError(error);
  }
  return NextResponse.json(body, { status });
}
