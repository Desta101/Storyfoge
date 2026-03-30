/**
 * Shared Gemini / Google AI quota + rate-limit classification and retry delay parsing.
 * GoogleGenerativeAIFetchError may include `errorDetails` (RetryInfo, quota metadata).
 */

export type GeminiFailureAnalysis = {
  mockReason: string;
  /** Milliseconds the client should wait before retrying (from RetryInfo when present). */
  retryAfterMs?: number;
};

function geminiErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status;
  if (typeof s === "number") return s;
  const c = (err as { statusCode?: unknown }).statusCode;
  if (typeof c === "number") return c;
  return undefined;
}

function errorDetailsJson(err: unknown): string {
  if (!err || typeof err !== "object" || !("errorDetails" in err)) return "";
  const d = (err as { errorDetails?: unknown }).errorDetails;
  if (d === undefined || d === null) return "";
  try {
    return JSON.stringify(d);
  } catch {
    return String(d);
  }
}

/** Full text used for keyword detection (message + structured details). */
export function geminiErrorFingerprint(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  return `${base} ${errorDetailsJson(err)}`;
}

function parseDurationToMs(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const m = value.match(/^(\d+(?:\.\d+)?)s$/i);
    if (m) {
      const sec = parseFloat(m[1]!);
      if (!Number.isNaN(sec) && sec >= 0) return Math.ceil(sec * 1000);
    }
  }
  if (typeof value === "object") {
    const o = value as { seconds?: unknown; nanos?: unknown };
    if (typeof o.seconds === "string" || typeof o.seconds === "number") {
      const sec =
        typeof o.seconds === "string" ? parseInt(o.seconds, 10) : o.seconds;
      if (!Number.isNaN(sec) && sec >= 0) {
        const nanos =
          typeof o.nanos === "number" && o.nanos > 0 ? o.nanos / 1e9 : 0;
        return Math.ceil((sec + nanos) * 1000);
      }
    }
  }
  return undefined;
}

/**
 * Extract retry delay from GoogleGenerativeAIFetchError.errorDetails (RetryInfo)
 * or from embedded JSON in the error message string.
 */
export function extractRetryDelayMsFromGeminiError(err: unknown): number | undefined {
  if (err && typeof err === "object" && "errorDetails" in err) {
    const details = (err as { errorDetails?: unknown }).errorDetails;
    if (Array.isArray(details)) {
      for (const item of details) {
        if (!item || typeof item !== "object") continue;
        const retryDelay = (item as { retryDelay?: unknown }).retryDelay;
        const ms = parseDurationToMs(retryDelay);
        if (ms != null && ms > 0) return ms;
      }
    }
  }

  const fp = geminiErrorFingerprint(err);
  const quoted = fp.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (quoted) {
    const sec = parseFloat(quoted[1]!);
    if (!Number.isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
  }
  return undefined;
}

function looksLikeFreeQuotaExhaustion(text: string): boolean {
  const low = text.toLowerCase();
  if (/\bquota\b/.test(low)) return true;
  if (low.includes("quotafailure") || low.includes("quota failure")) return true;
  if (low.includes("quota exceeded")) return true;
  if (low.includes("resource has been exhausted")) return true;
  if (low.includes("generate_requests") || low.includes("generaterequests"))
    return true;
  if (low.includes("requests per") || low.includes("per day") || low.includes("per minute"))
    return true;
  if (low.includes("free tier") || low.includes("billing")) return true;
  if (low.includes("consumer_quota") || low.includes("consumer quota"))
    return true;
  return false;
}

function looksLikeRateLimit(text: string, status: number | undefined): boolean {
  if (status === 429) return true;
  const low = text.toLowerCase();
  return (
    low.includes("resource exhausted") ||
    low.includes("rate limit") ||
    low.includes("too many requests") ||
    text.includes("429")
  );
}

/**
 * Maps a thrown Gemini / fetch error to a StoryForge `generationMockReason` and optional cooldown.
 */
export function analyzeGeminiFailure(err: unknown): GeminiFailureAnalysis {
  const fp = geminiErrorFingerprint(err);
  const low = fp.toLowerCase();
  const status = geminiErrorStatus(err);
  const retryAfterMs = extractRetryDelayMsFromGeminiError(err);

  if (low.includes("timed out") || low.includes("timeout")) {
    return { mockReason: "timeout", retryAfterMs };
  }
  if (
    low.includes("api key not valid") ||
    low.includes("invalid api key") ||
    low.includes("403") ||
    low.includes("401")
  ) {
    return { mockReason: "invalid_api_key", retryAfterMs };
  }
  if (
    low.includes("model") &&
    (low.includes("not found") || low.includes("not supported"))
  ) {
    return { mockReason: "model_not_found", retryAfterMs };
  }

  const quotaLike = looksLikeFreeQuotaExhaustion(fp);
  const rateLike = looksLikeRateLimit(fp, status);

  if (quotaLike && rateLike) {
    return { mockReason: "gemini_free_quota", retryAfterMs };
  }
  if (quotaLike) {
    return { mockReason: "gemini_free_quota", retryAfterMs };
  }
  if (rateLike) {
    return { mockReason: "rate_limit", retryAfterMs };
  }

  return { mockReason: "gemini_request_failed", retryAfterMs };
}
