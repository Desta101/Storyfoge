"use client";

import { useEffect, useMemo, useState } from "react";

type UseGeminiQuotaCooldownOptions = {
  generationMockReason?: string;
  generationRetryAfterMs?: number;
};

/**
 * Client-side cooldown after Gemini quota / rate-limit responses that include RetryInfo.
 * Disables repeated AI actions until the window elapses.
 */
export function useGeminiQuotaCooldown({
  generationMockReason,
  generationRetryAfterMs,
}: UseGeminiQuotaCooldownOptions) {
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const hasRetry =
      typeof generationRetryAfterMs === "number" && generationRetryAfterMs > 0;
    const eligibleReason =
      generationMockReason === "gemini_free_quota" ||
      generationMockReason === "rate_limit";
    if (hasRetry && eligibleReason) {
      setCooldownUntil(Date.now() + generationRetryAfterMs!);
    } else {
      setCooldownUntil(null);
    }
  }, [generationMockReason, generationRetryAfterMs]);

  useEffect(() => {
    if (!cooldownUntil) return;
    if (Date.now() >= cooldownUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const quotaCooldownActive = useMemo(() => {
    if (!cooldownUntil) return false;
    return now < cooldownUntil;
  }, [cooldownUntil, now]);

  const quotaSecondsLeft = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  }, [cooldownUntil, now]);

  return { quotaCooldownActive, quotaSecondsLeft };
}
