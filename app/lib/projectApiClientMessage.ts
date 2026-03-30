/**
 * Client-safe: parse project API error bodies without importing server-only modules.
 */

export type ProjectApiErrorBody = {
  error?: string;
  /** Set by the server only in development. */
  debug?: string;
};

export function messageFromProjectApiError(
  body: ProjectApiErrorBody | null | undefined,
  fallback: string,
): string {
  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "development" &&
    body?.debug
  ) {
    return body.debug;
  }
  return body?.error ?? fallback;
}
