"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGeminiQuotaCooldown } from "../hooks/useGeminiQuotaCooldown";
import { useGenerateComicPage } from "../hooks/useGenerateComicPage";
import AppHeader from "../components/AppHeader";
import UpgradeModal from "../components/UpgradeModal";
import {
  UPGRADE_MESSAGE_CHARACTER_LOCKED,
  UPGRADE_MESSAGE_CHARACTER_REGENERATE_LIMIT,
  UPGRADE_MESSAGE_PAGE_GENERATION_LIMIT,
} from "../lib/upgradeCopy";
import { fetchCurrentPlanTier, type PlanTier } from "../lib/plan";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import {
  characterPortraitPlaceholderUrl,
  loadStoryDraftFromStorage,
  saveStoryDraftToStorage,
  type StoryDraft,
} from "../lib/storyDraft";

const supabase = createSupabaseBrowserClient();

/** Session key: remember which character is the free "look" slot for this story (same tab). */
const FREE_CHARACTER_SLOT_SESSION_KEY = "storyforge.freeCharacterLookSlot";

type CardState = {
  id: string;
  role: string;
  name: string;
  visual: string;
  lookVariant: number;
  imagePrompt?: string;
  portraitUrl?: string;
  /** Portrait URL (stored draft or placeholder). */
  imageUrl?: string;
};

const heroVariants = [
  "Cinder-red hair, ember-glow eyes, and a coat stitched with living embers.",
  "Ash-blonde hair, blue flame lashes, and a travel cloak lined with rune-ink.",
  "Dark bronze hair, warm hearth aura, and gloves that crackle with heat.",
];
const villainVariants = [
  "Night-black silhouette, floating ash fragments, and a collar of fractured dusk.",
  "Charcoal armor plates, ember-thin smile, and a shadow-chain that hums quietly.",
  "Deep violet void-skin, drifting smoke rings, and a crown of broken cinders.",
];
const mentorVariants = [
  "Silver threaded hair, calm gaze, and a lantern-like aura under a violet cloak.",
  "Jet-black bangs, soft golden sigils, and a staff-top that fractures light.",
  "White-lace braids, steady eyes, and a mantle that glows like captured moonfire.",
];

function variantsFor(index: number) {
  const sets = [heroVariants, villainVariants, mentorVariants];
  return sets[index % 3] ?? heroVariants;
}

function storySlotFingerprint(draft: StoryDraft) {
  return `${draft.format}::${draft.title}::${draft.idea.slice(0, 120)}`;
}

function sameCharacterId(a: string, b: string) {
  return String(a).trim() === String(b).trim();
}

function readStoredFreeSlot(draft: StoryDraft): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FREE_CHARACTER_SLOT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fp?: string; id?: string };
    if (parsed.fp !== storySlotFingerprint(draft) || typeof parsed.id !== "string") {
      return null;
    }
    const exists = draft.characters.some((c) => sameCharacterId(c.id, parsed.id!));
    return exists ? parsed.id : null;
  } catch {
    return null;
  }
}

function writeStoredFreeSlot(draft: StoryDraft, characterId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      FREE_CHARACTER_SLOT_SESSION_KEY,
      JSON.stringify({
        fp: storySlotFingerprint(draft),
        id: characterId,
      }),
    );
  } catch {
    // ignore
  }
}

function clearStoredFreeSlot() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FREE_CHARACTER_SLOT_SESSION_KEY);
  } catch {
    // ignore
  }
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function accentClassForRole(role: string) {
  const r = role.toLowerCase();
  if (r.includes("villain")) return "from-cyan-500/20 to-transparent";
  if (r.includes("hero")) return "from-fuchsia-500/20 to-transparent";
  if (r.includes("mentor")) return "from-white/20 to-transparent";
  return "from-fuchsia-500/15 via-cyan-500/10 to-transparent";
}

function RoleAccent({ role }: { role: string }) {
  const className = useMemo(() => accentClassForRole(role), [role]);

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70",
        className,
      ].join(" ")}
    />
  );
}

function CharacterCard({
  card,
  canEdit,
  aiBusy,
  onRegenerate,
  onLockedEdit,
}: {
  card: CardState;
  canEdit: boolean;
  aiBusy: boolean;
  onRegenerate: () => void;
  onLockedEdit: () => void;
}) {
  return (
    <div className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6">
      <RoleAccent role={card.role} />

      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-foreground/90"
            aria-label={`${card.role} role`}
          >
            {card.role}
          </div>
          <div className="text-xs font-semibold text-foreground/60">SF</div>
        </div>

        <div className="mt-5 shrink-0">
          <div className="text-xl font-semibold tracking-tight">
            {card.name}
          </div>
          <p
            className="mt-2 min-h-[5.5rem] text-sm leading-relaxed text-foreground/80 line-clamp-4 sm:min-h-[6rem]"
            title={card.visual}
          >
            {card.visual}
          </p>
        </div>

        <div className="mt-5 shrink-0">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="relative aspect-[3/4] w-full min-h-[220px] max-h-[320px]">
              <img
                src={
                  card.portraitUrl?.trim() ||
                  card.imageUrl?.trim() ||
                  characterPortraitPlaceholderUrl(card.id, card.lookVariant)
                }
                alt={`${card.name} portrait`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
              />
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75">
                  Character portrait
                </span>
                <span className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                  Look {card.lookVariant + 1}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex shrink-0 flex-col pt-5">
          <button
            type="button"
            onClick={() => {
              if (canEdit && aiBusy) return;
              if (canEdit) onRegenerate();
              else onLockedEdit();
            }}
            disabled={canEdit && aiBusy}
            className={[
              "inline-flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition",
              canEdit
                ? "border-white/10 bg-white/5 text-foreground/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                : "border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20",
            ].join(" ")}
          >
            {canEdit ? "Regenerate Look" : "Locked on Free plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CharacterPreviewClient() {
  const router = useRouter();
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [charactersGenBanner, setCharactersGenBanner] = useState<string | null>(
    null,
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [freeEditableId, setFreeEditableId] = useState<string | null>(null);
  const [regenFreeze, setRegenFreeze] = useState(false);
  const regenGuardRef = useRef(false);

  const cardById = useMemo(() => {
    const map = new Map<string, CardState>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const onComicPageLimit = useCallback(() => {
    setUpgradeReason(UPGRADE_MESSAGE_PAGE_GENERATION_LIMIT);
    setShowUpgradeModal(true);
  }, []);

  const onComicDraftUpdated = useCallback((next: StoryDraft) => {
    setDraft(next);
  }, []);

  const {
    isGeneratingComic,
    comicGenNotice,
    comicPageGenerationLocked,
    generateComicPage,
  } = useGenerateComicPage({
    draft,
    planTier,
    isAuthenticated,
    isReady: !isLoading,
    onPageLimitReached: onComicPageLimit,
    onDraftUpdated: onComicDraftUpdated,
  });

  const { quotaCooldownActive: comicQuotaCooldown, quotaSecondsLeft: comicQuotaSecondsLeft } =
    useGeminiQuotaCooldown({
      generationMockReason: draft?.generationMockReason,
      generationRetryAfterMs: draft?.generationRetryAfterMs,
    });

  function regenerate(characterId: string) {
    if (regenGuardRef.current || isGeneratingComic || comicQuotaCooldown) return;

    if (
      planTier === "free" &&
      freeEditableId != null &&
      !sameCharacterId(freeEditableId, characterId)
    ) {
      setUpgradeReason(UPGRADE_MESSAGE_CHARACTER_REGENERATE_LIMIT);
      setShowUpgradeModal(true);
      return;
    }

    if (planTier === "free" && freeEditableId == null) {
      setFreeEditableId(characterId);
      if (draft) writeStoredFreeSlot(draft, characterId);
    }

    regenGuardRef.current = true;
    setRegenFreeze(true);
    try {
      const idx =
        draft?.characters.findIndex((c) => sameCharacterId(c.id, characterId)) ??
        0;
      const current = cards.find((c) => sameCharacterId(c.id, characterId));
      const variants = variantsFor(idx);
      const nextVariant =
        ((current?.lookVariant ?? 0) + 1) % variants.length;
      const nextVisual = variants[nextVariant]!;
      const nextImageUrl = characterPortraitPlaceholderUrl(characterId, nextVariant);

      setCards((prev) =>
        prev.map((c) => {
          if (!sameCharacterId(c.id, characterId)) return c;
          return {
            ...c,
            lookVariant: nextVariant,
            visual: nextVisual,
            portraitUrl: nextImageUrl,
            imageUrl: nextImageUrl,
          };
        }),
      );

      if (draft) {
        const nextDraft = {
          ...draft,
          characters: draft.characters.map((c) =>
            sameCharacterId(c.id, characterId)
              ? {
                  ...c,
                  visual: nextVisual,
                  portraitUrl: nextImageUrl,
                  imageUrl: nextImageUrl,
                }
              : c,
          ),
        };
        setDraft(nextDraft);
        saveStoryDraftToStorage(nextDraft);
      }
    } finally {
      regenGuardRef.current = false;
      requestAnimationFrame(() => setRegenFreeze(false));
    }
  }

  useEffect(() => {
    async function auth() {
      try {
        if (!supabase) {
          setIsAuthenticated(false);
          return;
        }
        const { data } = await supabase.auth.getUser();
        setIsAuthenticated(Boolean(data?.user));
      } catch {
        setIsAuthenticated(false);
      }
    }
    void auth();
  }, []);

  useEffect(() => {
    void fetchCurrentPlanTier().then((tier) => {
      setPlanTier(tier);
      if (tier === "premium") {
        clearStoredFreeSlot();
        setFreeEditableId(null);
      }
    });
    try {
      const notice = sessionStorage.getItem("storyforge.charactersGenNotice");
      if (notice) {
        setCharactersGenBanner(notice);
        sessionStorage.removeItem("storyforge.charactersGenNotice");
      }
    } catch {
      // ignore
    }
    const loaded = loadStoryDraftFromStorage();
    setDraft(loaded);
    if (loaded) {
      setCards(
        loaded.characters.map((c) => ({
          id: c.id,
          role: c.role,
          name: c.name,
          visual: c.visual,
          lookVariant: 0,
          imagePrompt: c.imagePrompt,
          portraitUrl: c.portraitUrl,
          imageUrl: c.imageUrl,
        })),
      );
      const stored = readStoredFreeSlot(loaded);
      if (stored) setFreeEditableId(stored);
    }
    setIsLoading(false);
  }, []);

  /** Recover from stale slot id (e.g. draft ids changed) so we never lock every card. */
  useEffect(() => {
    if (planTier !== "free" || !draft || freeEditableId == null) return;
    const ok = draft.characters.some((c) => sameCharacterId(c.id, freeEditableId));
    if (!ok) {
      setFreeEditableId(null);
      clearStoredFreeSlot();
    }
  }, [planTier, draft, freeEditableId]);

  const characterAiBusy =
    isGeneratingComic || regenFreeze || comicQuotaCooldown;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader action={{ href: "/create", label: "Back" }} />
        <main className="mx-auto w-full max-w-6xl px-6 pb-16">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
            <div className="h-10 w-56 animate-pulse rounded bg-white/5" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="h-[360px] animate-pulse rounded-3xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          </section>
        </main>
        <UpgradeModal
          open={showUpgradeModal}
          reason={upgradeReason}
          onUpgrade={() => {
            setShowUpgradeModal(false);
            router.push("/pricing");
          }}
          onMaybeLater={() => setShowUpgradeModal(false)}
        />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader action={{ href: "/create", label: "Back" }} />
        <main className="mx-auto w-full max-w-6xl px-6 pb-16">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Character Preview
            </h1>
            <p className="mt-2 text-base leading-relaxed text-foreground/80 sm:text-lg">
              No draft found. Generate a story first.
            </p>
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
        <UpgradeModal
          open={showUpgradeModal}
          reason={upgradeReason}
          onUpgrade={() => {
            setShowUpgradeModal(false);
            router.push("/pricing");
          }}
          onMaybeLater={() => setShowUpgradeModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader action={{ href: "/create", label: "Back" }} />

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Character Preview
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
              Here are the visual directions for your characters.
            </p>
            {planTier === "free" ? (
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-foreground/55">
                Free plan: your first &ldquo;Regenerate Look&rdquo; picks the one
                character you can cycle. Other characters stay locked unless you
                upgrade.
              </p>
            ) : null}
          </div>

          {charactersGenBanner ? (
            <div className="mt-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100/90">
              {charactersGenBanner}
            </div>
          ) : null}
          {comicGenNotice ||
          (comicQuotaCooldown && comicQuotaSecondsLeft > 0) ? (
            <div className="mt-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100/90">
              {comicGenNotice ? (
                <>
                  {comicGenNotice}
                  {comicQuotaCooldown && comicQuotaSecondsLeft > 0 ? (
                    <span className="mt-2 block text-xs text-fuchsia-200/80">
                      Try again in {comicQuotaSecondsLeft}s
                    </span>
                  ) : null}
                </>
              ) : comicQuotaCooldown && comicQuotaSecondsLeft > 0 ? (
                <span className="text-xs text-fuchsia-200/85">
                  Try again in {comicQuotaSecondsLeft}s
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-10 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-h-0 [&>*]:min-w-0">
            {draft.characters.map((c) => {
              const card = cardById.get(c.id) ?? {
                id: c.id,
                role: c.role,
                name: c.name,
                visual: c.visual,
                lookVariant: 0,
                imagePrompt: c.imagePrompt,
                portraitUrl: c.portraitUrl,
                imageUrl: c.imageUrl,
              };
              const isPremium = planTier === "premium";
              const isChosenFreeSlot =
                freeEditableId != null && sameCharacterId(freeEditableId, c.id);
              const canEdit =
                isPremium ||
                freeEditableId === null ||
                isChosenFreeSlot;
              return (
                <CharacterCard
                  key={c.id}
                  card={card}
                  canEdit={canEdit}
                  aiBusy={characterAiBusy}
                  onRegenerate={() => regenerate(c.id)}
                  onLockedEdit={() => {
                    setUpgradeReason(UPGRADE_MESSAGE_CHARACTER_LOCKED);
                    setShowUpgradeModal(true);
                  }}
                />
              );
            })}
          </div>

          <div className="mt-10">
            {comicPageGenerationLocked ? (
              <button
                type="button"
                title="Free plan page limit reached"
                onClick={onComicPageLimit}
                className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-500/[0.06] px-8 text-sm font-semibold text-fuchsia-100/70 opacity-90 shadow-sm shadow-black/20 sm:w-auto"
              >
                <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/60" />
                Generate Comic Page
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-8 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={characterAiBusy}
                onClick={() => void generateComicPage()}
              >
                {isGeneratingComic ? "Generating..." : "Generate Comic Page"}
              </button>
            )}
          </div>
        </section>
      </main>
      <UpgradeModal
        open={showUpgradeModal}
        reason={upgradeReason}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          router.push("/pricing");
        }}
        onMaybeLater={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
