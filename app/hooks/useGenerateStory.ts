"use client";

import { useCallback, useRef, useState } from "react";
import {
  safeParseStoryDraft,
  type StoryDraft,
  type StoryFormat,
} from "../lib/storyDraft";

const DEFAULT_TIMEOUT_MS = 50_000;

export type GenerateStoryInput = {
  format: StoryFormat;
  idea: string;
};

export type GenerateStoryResult =
  | { ok: true; draft: StoryDraft }
  | { ok: false; error: string };

type UseGenerateStoryOptions = {
  /**
   * Abort the request after this many ms (create flow uses 50s).
   * Pass `null` or `0` to disable the client-side timeout (e.g. story preview retry).
   */
  timeoutMs?: number | null;
};

/**
 * POST `/api/generate-story` with loading/error state — used from Create and Story Preview.
 */
export function useGenerateStory(options?: UseGenerateStoryOptions) {
  const timeoutMs =
    options?.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const generateStory = useCallback(
    async (input: GenerateStoryInput): Promise<GenerateStoryResult> => {
      if (inFlightRef.current) {
        return { ok: false, error: "" };
      }
      inFlightRef.current = true;
      setError(null);
      setIsGenerating(true);
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const controller = new AbortController();
      try {
        if (timeoutMs != null && timeoutMs > 0) {
          timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        }

        const res = await fetch("/api/generate-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: input.format,
            idea: input.idea,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error || "Failed to generate story");
        }

        const json = (await res.json()) as unknown;
        const parsed = safeParseStoryDraft(JSON.stringify(json));
        if (!parsed) {
          throw new Error("Generation returned an invalid draft.");
        }
        return { ok: true, draft: parsed };
      } catch (e) {
        const message =
          e instanceof Error
            ? e.name === "AbortError"
              ? "Generation timed out. Please try again."
              : e.message
            : "Failed to generate story";
        setError(message);
        return { ok: false, error: message };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        inFlightRef.current = false;
        setIsGenerating(false);
      }
    },
    [timeoutMs],
  );

  return {
    isGenerating,
    error,
    clearError,
    setError,
    generateStory,
  };
}
