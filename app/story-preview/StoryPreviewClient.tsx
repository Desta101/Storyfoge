"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGeminiQuotaCooldown } from "../hooks/useGeminiQuotaCooldown";
import { useGenerateStory } from "../hooks/useGenerateStory";
import AppHeader from "../components/AppHeader";
import { markFirstEvent, trackAnalyticsEvent } from "../lib/analytics";
import {
  loadStoryDraftFromStorage,
  saveStoryDraftToStorage,
  type CharacterDraft,
  type StoryDraft,
} from "../lib/storyDraft";

type Character = CharacterDraft;

function accentForRole(role: string) {
  const r = role.toLowerCase();
  if (r.includes("villain")) {
    return {
      badgeBg: "bg-cyan-500/15",
      badgeText: "text-cyan-200",
      glow: "from-cyan-500/25 to-transparent",
    };
  }
  if (r.includes("hero")) {
    return {
      badgeBg: "bg-fuchsia-500/15",
      badgeText: "text-fuchsia-200",
      glow: "from-fuchsia-500/25 to-transparent",
    };
  }
  if (r.includes("mentor")) {
    return {
      badgeBg: "bg-white/10",
      badgeText: "text-foreground",
      glow: "from-white/20 to-transparent",
    };
  }
  return {
    badgeBg: "bg-white/10",
    badgeText: "text-foreground",
    glow: "from-fuchsia-500/15 via-cyan-500/10 to-transparent",
  };
}

function CharacterCard({
  character,
}: {
  character: Character;
}) {
  const accents = useMemo(() => accentForRole(character.role), [character.role]);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6">
      <div
        className={[
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
          accents.glow,
        ].join(" ")}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div
            className={[
              "rounded-full border border-white/10 px-3 py-1 text-xs font-semibold",
              accents.badgeBg,
              accents.badgeText,
            ].join(" ")}
          >
            {character.role}
          </div>
          <div className="text-xs font-semibold text-foreground/60">SF</div>
        </div>

        <div className="mt-5">
          <div className="text-xl font-semibold tracking-tight">
            {character.name}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground/80">
            {character.personality}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-foreground/70">
          Visual direction:{" "}
          <span className="font-semibold text-foreground">{character.visual}</span>
        </div>
      </div>
    </div>
  );
}

export default function StoryPreviewClient() {
  const router = useRouter();
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const {
    isGenerating: isRetryingStory,
    generateStory: requestGenerateStory,
  } = useGenerateStory({ timeoutMs: null });
  const [characterGenNotice, setCharacterGenNotice] = useState<string | null>(
    null,
  );
  const characterGenInFlightRef = useRef(false);

  useEffect(() => {
    setDraft(loadStoryDraftFromStorage());
  }, []);

  const genreTag = draft?.format === "comic" ? "Comic" : "Manga";
  const isMockMode = draft?.generationMode === "mock";
  const characters = draft?.characters ?? [];
  const chapterPreview = draft?.chapterPreview ?? "";
  const title = draft?.title ?? "";
  const summary = draft?.summary ?? "";
  const world = draft?.storyWorld;

  const { quotaCooldownActive, quotaSecondsLeft } = useGeminiQuotaCooldown({
    generationMockReason:
      draft?.generationMode === "mock"
        ? draft.generationMockReason
        : undefined,
    generationRetryAfterMs:
      draft?.generationMode === "mock"
        ? draft.generationRetryAfterMs
        : undefined,
  });

  const storyAiBusy =
    isGenerating || isRetryingStory || quotaCooldownActive;
  const buttonText = isGenerating ? "Generating..." : "Generate Characters";

  async function onGenerateCharacters() {
    if (!draft || characterGenInFlightRef.current) return;
    characterGenInFlightRef.current = true;
    setIsGenerating(true);
    setCharacterGenNotice(null);
    try {
      const res = await fetch("/api/generate-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });

      const json = (await res.json().catch(() => null)) as
        | {
            characters?: StoryDraft["characters"];
            charactersGenerationMode?: "ai" | "mock";
            generationMockReason?: string;
            error?: string;
          }
        | null;

      if (!res.ok || !json?.characters) {
        throw new Error(json?.error || "Failed to generate characters.");
      }

      const nextDraft: StoryDraft = {
        ...draft,
        characters: json.characters,
      };
      saveStoryDraftToStorage(nextDraft);
      setDraft(nextDraft);

      void trackAnalyticsEvent({
        event: "characters_generated",
        properties: {
          mode: json.charactersGenerationMode ?? "unknown",
          first_time: markFirstEvent("characters_generated"),
        },
      });

      try {
        if (json.charactersGenerationMode === "mock") {
          const notice =
            json.generationMockReason === "gemini_free_quota"
              ? "Gemini free quota reached. Please wait and try again."
              : "Character refresh used a fallback because AI generation was unavailable.";
          sessionStorage.setItem("storyforge.charactersGenNotice", notice);
        } else {
          sessionStorage.removeItem("storyforge.charactersGenNotice");
        }
      } catch {
        // ignore
      }

      router.push("/character-preview");
    } catch (e) {
      setCharacterGenNotice(
        e instanceof Error
          ? e.message
          : "Could not generate characters. Please try again.",
      );
    } finally {
      characterGenInFlightRef.current = false;
      setIsGenerating(false);
    }
  }

  async function onTryAIAgain() {
    if (!draft || isRetryingStory || isGenerating || quotaCooldownActive) return;
    setRetryError(null);
    const result = await requestGenerateStory({
      format: draft.format,
      idea: draft.idea,
    });
    if (!result.ok) {
      if (result.error) setRetryError(result.error);
      return;
    }
    const parsed = result.draft;
    saveStoryDraftToStorage(parsed);
    setDraft(parsed);
    if (parsed.generationMode === "mock") {
      const why = parsed.generationMockReason;
      if (why === "gemini_free_quota") {
        setRetryError(
          "Gemini free quota reached. Please wait and try again.",
        );
      } else if (why === "rate_limit") {
        setRetryError(
          "Too many requests were sent in a short time. Please wait a moment and try again.",
        );
      } else if (why) {
        setRetryError(`AI unavailable (${why}). Showing mock preview.`);
      } else {
        setRetryError("AI is still unavailable. Showing mock preview.");
      }
    }
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader action={{ href: "/create", label: "Back" }} />

        <main className="mx-auto w-full max-w-6xl px-6 pb-16">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Your Story Preview
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
                No draft found. Generate a story first to unlock the preview.
              </p>
            </div>

            <div className="mt-8">
              <Link
                href="/create"
                className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-8 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
              >
                Back to Create
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader action={{ href: "/create", label: "Back" }} />

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Your Story Preview
              </h1>
              <p className="mt-2 text-base leading-relaxed text-foreground/80 sm:text-lg">
                {title}
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 sm:mt-0">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-foreground/90">
                {genreTag}
              </span>
              {isMockMode ? (
                <span className="inline-flex items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-200">
                  Mock preview mode
                </span>
              ) : null}
            </div>
          </div>

          {isMockMode ? (
            <div className="mt-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {draft.generationMockReason === "gemini_free_quota" ? (
                    <>
                      <p className="text-sm font-semibold text-fuchsia-100">
                        Gemini free quota reached. Please wait and try again.
                      </p>
                      {quotaCooldownActive && quotaSecondsLeft > 0 ? (
                        <p
                          className="mt-2 text-xs text-fuchsia-200/85"
                          aria-live="polite"
                        >
                          Try again in {quotaSecondsLeft}s
                        </p>
                      ) : null}
                    </>
                  ) : draft.generationMockReason === "rate_limit" ? (
                    <>
                      <p className="text-sm font-semibold text-fuchsia-100">
                        AI is temporarily busy
                      </p>
                      <p className="mt-2 text-sm text-fuchsia-100/90">
                        Too many requests were sent in a short time. Please wait a
                        moment and try again.
                      </p>
                      {quotaCooldownActive && quotaSecondsLeft > 0 ? (
                        <p
                          className="mt-2 text-xs text-fuchsia-200/85"
                          aria-live="polite"
                        >
                          Try again in {quotaSecondsLeft}s
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-fuchsia-100/90">
                        This is a mock preview because AI generation is currently
                        unavailable.
                      </p>
                      {draft.generationMockReason ? (
                        <p className="mt-2 font-mono text-[11px] text-fuchsia-200/70">
                          Reason: {draft.generationMockReason}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void onTryAIAgain()}
                  disabled={storyAiBusy}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 text-sm font-semibold text-foreground transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetryingStory ? "Retrying..." : "Try AI Again"}
                </button>
              </div>
              {retryError ? (
                <p className="mt-2 text-xs text-fuchsia-100/80" aria-live="polite">
                  {retryError}
                </p>
              ) : null}
            </div>
          ) : null}

          {world &&
          (world.background ||
            world.theme ||
            world.tone ||
            world.timePeriod) ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-foreground/80">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Story world
              </div>
              <ul className="mt-2 space-y-1 text-foreground/75">
                {world.background ? (
                  <li>
                    <span className="text-foreground/50">Setting: </span>
                    {world.background}
                  </li>
                ) : null}
                {world.theme ? (
                  <li>
                    <span className="text-foreground/50">Theme: </span>
                    {world.theme}
                  </li>
                ) : null}
                {world.tone ? (
                  <li>
                    <span className="text-foreground/50">Tone: </span>
                    {world.tone}
                  </li>
                ) : null}
                {world.timePeriod ? (
                  <li>
                    <span className="text-foreground/50">Era: </span>
                    {world.timePeriod}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/80 sm:text-base">
            {summary}
          </p>

          <div className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Characters
              </h2>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={storyAiBusy}
                onClick={() => void onGenerateCharacters()}
              >
                {buttonText}
              </button>
            </div>

            {characterGenNotice ? (
              <p
                className="mt-3 text-sm text-fuchsia-200/90"
                aria-live="polite"
              >
                {characterGenNotice}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((c) => (
                <CharacterCard key={c.id} character={c} />
              ))}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">
              Chapter 1
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/80 sm:text-base">
              {chapterPreview}
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-foreground/70">
              Panel note: the opening spread uses a warm gradient silhouette
              to contrast the encroaching dusk.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
