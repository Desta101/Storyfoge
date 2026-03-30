"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ROLE_PRESETS,
  emptyCharacterTemplate,
  ensureDraftIntegrity,
  type StoryDraft,
  type StoryFormat,
} from "../../lib/storyDraft";
import {
  FREE_PLAN_MAX_CHARACTERS,
  PREMIUM_PLAN_MAX_CHARACTERS,
  type PlanTier,
} from "../../lib/plan";

type Props = {
  value: StoryDraft;
  planTier: PlanTier;
  onUserDraftChange: (next: StoryDraft) => void;
};

const DEBOUNCE_MS = 1100;

function isPresetRole(role: string) {
  return (ROLE_PRESETS as readonly string[]).includes(role);
}

export default function ProjectStoryEditor({
  value,
  planTier,
  onUserDraftChange,
}: Props) {
  const maxChars =
    planTier === "premium" ? PREMIUM_PLAN_MAX_CHARACTERS : FREE_PLAN_MAX_CHARACTERS;

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const userEditedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyDraft = useCallback(
    (next: StoryDraft, markUserEdit: boolean) => {
      if (markUserEdit) userEditedRef.current = true;
      onUserDraftChange(ensureDraftIntegrity(next));
    },
    [onUserDraftChange],
  );

  const runSmartRefresh = useCallback(
    async (draft: StoryDraft) => {
      setSyncing(true);
      setSyncMessage(null);
      try {
        const res = await fetch("/api/refresh-story-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: ensureDraftIntegrity(draft) }),
        });
        const json = (await res.json()) as {
          summary?: string;
          chapterPreview?: string;
          comicPanels?: StoryDraft["comicPanels"];
          refreshMode?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Sync failed");
        if (!json.summary || !json.chapterPreview || !json.comicPanels) {
          throw new Error("Invalid sync response");
        }
        userEditedRef.current = false;
        onUserDraftChange(
          ensureDraftIntegrity({
            ...draft,
            summary: json.summary,
            chapterPreview: json.chapterPreview,
            comicPanels: json.comicPanels,
          }),
        );
        const isAi = json.refreshMode === "ai";
        setSyncMessage(
          planTier === "premium" && isAi
            ? "Summary, chapter preview, and panels synced (AI)."
            : planTier === "premium"
              ? "Synced using preview mode (AI unavailable)."
              : "Preview updated (basic sync). Upgrade for full AI sync.",
        );
      } catch (e) {
        setSyncMessage(
          e instanceof Error ? e.message : "Could not refresh story content.",
        );
      } finally {
        setSyncing(false);
      }
    },
    [onUserDraftChange, planTier],
  );

  useEffect(() => {
    if (planTier !== "premium") return;
    if (!userEditedRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const d = ensureDraftIntegrity(value);
      void runSmartRefresh(d);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value, planTier, runSmartRefresh]);

  const updateWorld = (patch: Partial<StoryDraft["storyWorld"]>) => {
    applyDraft(
      {
        ...value,
        storyWorld: { ...value.storyWorld, ...patch },
      },
      true,
    );
  };

  const updateCharacter = (index: number, next: StoryDraft["characters"][number]) => {
    const characters = [...value.characters];
    characters[index] = next;
    applyDraft({ ...value, characters }, true);
  };

  const moveCharacter = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= value.characters.length) return;
    const characters = [...value.characters];
    const t = characters[index]!;
    characters[index] = characters[j]!;
    characters[j] = t;
    applyDraft({ ...value, characters }, true);
  };

  const removeCharacter = (index: number) => {
    if (value.characters.length <= 1) return;
    const characters = value.characters.filter((_, i) => i !== index);
    applyDraft({ ...value, characters }, true);
  };

  const addCharacter = () => {
    if (value.characters.length >= maxChars) return;
    applyDraft(
      {
        ...value,
        characters: [...value.characters, emptyCharacterTemplate("Friend")],
      },
      true,
    );
  };

  const replaceCharacter = (index: number) => {
    const prev = value.characters[index]?.role ?? "Hero";
    updateCharacter(index, emptyCharacterTemplate(prev));
  };

  const fieldClass =
    "mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-fuchsia-400/40";

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Story editor</h2>
          <p className="mt-1 text-xs text-foreground/60">
            {planTier === "premium"
              ? `Premium: up to ${PREMIUM_PLAN_MAX_CHARACTERS} characters. Edits auto-sync summary, chapter preview, and comic dialogue.`
              : `Free: up to ${FREE_PLAN_MAX_CHARACTERS} characters. Use basic preview sync or upgrade for AI sync.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void runSmartRefresh(ensureDraftIntegrity(value))}
            className={
              planTier === "premium"
                ? "inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(236,72,153,0.2)] transition hover:brightness-110 disabled:opacity-50"
                : "inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:opacity-50"
            }
          >
            {syncing
              ? "Updating…"
              : planTier === "premium"
                ? "Sync now"
                : "Update preview (basic)"}
          </button>
        </div>
      </div>

      {syncMessage ? (
        <div
          className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100/90"
          aria-live="polite"
        >
          {syncMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Project details
        </h3>
        <p className="mt-1 text-xs text-foreground/50">
          Title, idea, and format are saved with your project (including cloud sync when signed in).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-foreground/70 sm:col-span-2">
            Title
            <input
              type="text"
              value={value.title}
              onChange={(e) =>
                applyDraft({ ...value, title: e.target.value }, true)
              }
              className={fieldClass}
              placeholder="Working title…"
            />
          </label>
          <label className="block text-xs font-medium text-foreground/70 sm:col-span-2">
            Story idea / premise
            <textarea
              rows={3}
              value={value.idea}
              onChange={(e) =>
                applyDraft({ ...value, idea: e.target.value }, true)
              }
              className={fieldClass}
              placeholder="One paragraph on what you want to explore…"
            />
          </label>
          <label className="block text-xs font-medium text-foreground/70">
            Format
            <select
              value={value.format}
              onChange={(e) =>
                applyDraft(
                  { ...value, format: e.target.value as StoryFormat },
                  true,
                )
              }
              className={fieldClass}
            >
              <option value="manga">Manga</option>
              <option value="comic">Comic</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Story world
        </h3>
        <p className="mt-1 text-xs text-foreground/50">
          Background, theme, tone, and era — e.g. cyberpunk city, fantasy forest, school arc.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-foreground/70">
            Background / environment
            <textarea
              rows={2}
              value={value.storyWorld.background}
              onChange={(e) => updateWorld({ background: e.target.value })}
              className={fieldClass}
              placeholder="Neon harbor under monsoon clouds…"
            />
          </label>
          <label className="block text-xs font-medium text-foreground/70">
            Theme
            <input
              type="text"
              value={value.storyWorld.theme}
              onChange={(e) => updateWorld({ theme: e.target.value })}
              className={fieldClass}
              placeholder="Found family, debt, redemption…"
            />
          </label>
          <label className="block text-xs font-medium text-foreground/70">
            Tone
            <input
              type="text"
              value={value.storyWorld.tone}
              onChange={(e) => updateWorld({ tone: e.target.value })}
              className={fieldClass}
              placeholder="Hopeful noir, bittersweet…"
            />
          </label>
          <label className="block text-xs font-medium text-foreground/70">
            Time period
            <input
              type="text"
              value={value.storyWorld.timePeriod}
              onChange={(e) => updateWorld({ timePeriod: e.target.value })}
              className={fieldClass}
              placeholder="Near-future, medieval, modern day…"
            />
          </label>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Characters ({value.characters.length}/{maxChars})
          </h3>
          <button
            type="button"
            disabled={value.characters.length >= maxChars}
            onClick={addCharacter}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add character
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {value.characters.map((c, i) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground/50">
                  Importance #{i + 1}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-white/5 disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => moveCharacter(i, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-white/5 disabled:opacity-30"
                    disabled={i === value.characters.length - 1}
                    onClick={() => moveCharacter(i, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-white/5"
                    onClick={() => replaceCharacter(i)}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-red-400/30 px-3 py-1 text-xs font-semibold text-red-200/90 hover:bg-red-500/10 disabled:opacity-30"
                    disabled={value.characters.length <= 1}
                    onClick={() => removeCharacter(i)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-foreground/70">
                  Name
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) =>
                      updateCharacter(i, { ...c, name: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs font-medium text-foreground/70">
                  Role
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={isPresetRole(c.role) ? c.role : "__custom__"}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__custom__") {
                          updateCharacter(i, { ...c, role: "" });
                        } else {
                          updateCharacter(i, { ...c, role: v });
                        }
                      }}
                      className={`${fieldClass} sm:max-w-[12rem]`}
                    >
                      {ROLE_PRESETS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </select>
                    {!isPresetRole(c.role) ? (
                      <input
                        type="text"
                        value={c.role}
                        onChange={(e) =>
                          updateCharacter(i, { ...c, role: e.target.value })
                        }
                        className={fieldClass}
                        placeholder="Custom role label"
                      />
                    ) : null}
                  </div>
                </label>
              </div>

              <label className="mt-4 block text-xs font-medium text-foreground/70">
                Personality
                <textarea
                  rows={3}
                  value={c.personality}
                  onChange={(e) =>
                    updateCharacter(i, { ...c, personality: e.target.value })
                  }
                  className={fieldClass}
                  placeholder="Motivations, voice, internal conflict…"
                />
              </label>

              <label className="mt-4 block text-xs font-medium text-foreground/70">
                Visual description
                <textarea
                  rows={2}
                  value={c.visual}
                  onChange={(e) =>
                    updateCharacter(i, { ...c, visual: e.target.value })
                  }
                  className={fieldClass}
                  placeholder="Silhouette, palette, wardrobe…"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Live preview (synced)
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">{value.summary}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/50">
          Chapter preview
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/75">
          {value.chapterPreview}
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/50">
          Comic dialogue context
        </p>
        <ul className="mt-2 space-y-2 text-sm text-foreground/75">
          {value.comicPanels.map((p, idx) => (
            <li key={`${idx}-${p.tone}`} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                {p.tone}
              </span>
              <div className="mt-1 text-foreground/85">{p.caption}</div>
              <div className="text-foreground/70">&ldquo;{p.dialogue}&rdquo;</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
