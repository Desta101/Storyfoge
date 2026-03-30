"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FREE_PLAN_MAX_COMIC_PAGES,
  type PlanTier,
  getFreePagesUsed,
  incrementFreePagesUsed,
} from "../lib/plan";
import { saveStoryDraftToStorage, type StoryDraft } from "../lib/storyDraft";
import { markFirstEvent, trackAnalyticsEvent } from "../lib/analytics";

type UseGenerateComicPageOptions = {
  draft: StoryDraft | null;
  planTier: PlanTier;
  /** Only signed-in users are subject to the free-tier comic page cap. */
  isAuthenticated: boolean;
  /** When true, free-page count is synced from storage (e.g. after character preview loads). */
  isReady: boolean;
  /** Called when the user is at the free page cap (modal / upgrade). */
  onPageLimitReached: () => void;
  /** Persist the new draft in parent state after a successful generation. */
  onDraftUpdated: (next: StoryDraft) => void;
};

/**
 * Free-tier page cap, generation state, and POST to `/api/generate-comic-panels`
 * for the Character Preview → Comic Preview flow.
 */
export function useGenerateComicPage({
  draft,
  planTier,
  isAuthenticated,
  isReady,
  onPageLimitReached,
  onDraftUpdated,
}: UseGenerateComicPageOptions) {
  const router = useRouter();
  const [isGeneratingComic, setIsGeneratingComic] = useState(false);
  const [comicGenNotice, setComicGenNotice] = useState<string | null>(null);
  const [freePagesUsed, setFreePagesUsed] = useState(0);
  const comicGenInFlightRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    setFreePagesUsed(getFreePagesUsed());
  }, [isReady, planTier]);

  const comicPageGenerationLocked =
    isAuthenticated &&
    planTier === "free" &&
    freePagesUsed >= FREE_PLAN_MAX_COMIC_PAGES;

  const generateComicPage = useCallback(async () => {
    if (!draft) return;
    if (comicGenInFlightRef.current) return;
    if (isAuthenticated && planTier === "free") {
      const used = getFreePagesUsed();
      if (used >= FREE_PLAN_MAX_COMIC_PAGES) {
        onPageLimitReached();
        return;
      }
    }

    comicGenInFlightRef.current = true;
    setIsGeneratingComic(true);
    setComicGenNotice(null);
    try {
      const res = await fetch("/api/generate-comic-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            comicPanels?: StoryDraft["comicPanels"];
            comicPanelsGenerationMode?: "ai" | "mock";
            generationMockReason?: string;
            generationRetryAfterMs?: number;
            error?: string;
          }
        | null;

      if (!res.ok || !json?.comicPanels) {
        throw new Error(json?.error || "Failed to generate comic panels.");
      }

      const nextDraft: StoryDraft = {
        ...draft,
        comicPanels: json.comicPanels,
        ...(json.comicPanelsGenerationMode === "mock" && json.generationMockReason
          ? {
              generationMockReason: json.generationMockReason,
              ...(typeof json.generationRetryAfterMs === "number" &&
              json.generationRetryAfterMs > 0
                ? { generationRetryAfterMs: json.generationRetryAfterMs }
                : {}),
            }
          : json.comicPanelsGenerationMode === "ai" &&
              draft.generationMode === "ai"
            ? { generationMockReason: undefined, generationRetryAfterMs: undefined }
            : {}),
      };
      saveStoryDraftToStorage(nextDraft);
      if (isAuthenticated && planTier === "free") {
        incrementFreePagesUsed();
        setFreePagesUsed(getFreePagesUsed());
      }
      onDraftUpdated(nextDraft);
      void trackAnalyticsEvent({
        event: "comic_panels_generated",
        properties: {
          mode: json.comicPanelsGenerationMode ?? "unknown",
          first_time: markFirstEvent("comic_panels_generated"),
        },
      });
      if (json.comicPanelsGenerationMode === "mock") {
        if (json.generationMockReason === "gemini_free_quota") {
          setComicGenNotice(
            "Gemini free quota reached. Please wait and try again.",
          );
        } else {
          setComicGenNotice(
            "Comic page used a fallback because AI generation was unavailable.",
          );
        }
      }
      router.push("/comic-preview");
    } catch (e) {
      setComicGenNotice(
        e instanceof Error
          ? e.message
          : "Could not generate comic page. Please try again.",
      );
    } finally {
      comicGenInFlightRef.current = false;
      setIsGeneratingComic(false);
    }
  }, [
    draft,
    isAuthenticated,
    planTier,
    onPageLimitReached,
    onDraftUpdated,
    router,
  ]);

  return {
    isGeneratingComic,
    comicGenNotice,
    comicPageGenerationLocked,
    generateComicPage,
  };
}
