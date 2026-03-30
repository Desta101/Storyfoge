"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthRequiredModal from "../components/AuthRequiredModal";
import UpgradeModal from "../components/UpgradeModal";
import {
  comicPanelPlaceholderUrl,
  ensureDraftIntegrity,
  isComicPanelPlaceholderImageUrl,
  loadStoryDraftFromStorage,
  saveStoryDraftToStorage,
  type StoryDraft,
} from "../lib/storyDraft";
import {
  FREE_PLAN_MAX_SAVED_PROJECTS,
  fetchCurrentPlanTier,
  type PlanTier,
} from "../lib/plan";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import AppHeader from "../components/AppHeader";
import { markFirstEvent, trackAnalyticsEvent } from "../lib/analytics";
import { useDefaultExportFormat } from "../hooks/useDefaultExportFormat";
import { defaultExportFormatLabel } from "../lib/preferences";
import {
  messageFromProjectApiError,
  type ProjectApiErrorBody,
} from "../lib/projectApiClientMessage";
import {
  drainAuthReturnContextAtDestination,
  saveAuthReturnContext,
  type PendingAuthAction,
} from "../lib/authReturn";
import {
  UPGRADE_MESSAGE_BASIC_EXPORT_LIMIT,
  UPGRADE_MESSAGE_EDIT_PAGE,
  UPGRADE_MESSAGE_HD_EXPORT,
  UPGRADE_MESSAGE_FULL_COLOR,
  UPGRADE_MESSAGE_SAVE_PROJECT_LIMIT,
} from "../lib/upgradeCopy";

type Panel = {
  id: string;
  caption: string;
  dialogue: string;
  tone: "hero" | "villain" | "mentor" | "scene";
  /** 0-based index in the story draft’s comicPanels (for placeholder URLs). */
  panelIndex: number;
  imageUrl?: string;
};

type DisplayMode = "bw" | "color";
type ViewMode = "grid" | "reader";

const PANELS_PER_PAGE = 4;

// Panels are derived from the shared StoryDraft in storage.
const supabase = createSupabaseBrowserClient();

function fileSlug(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "storyforge-story";
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
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

function ExpandPanelIcon({ className }: { className?: string }) {
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
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function toneStyles(tone: Panel["tone"]) {
  switch (tone) {
    case "hero":
      return {
        glow: "from-fuchsia-500/12 to-transparent",
        bubble: "bg-fuchsia-500/10 border-fuchsia-300/20",
        bubbleText: "text-fuchsia-100",
      };
    case "villain":
      return {
        glow: "from-cyan-500/12 to-transparent",
        bubble: "bg-cyan-500/10 border-cyan-300/20",
        bubbleText: "text-cyan-100",
      };
    case "mentor":
      return {
        glow: "from-white/12 to-transparent",
        bubble: "bg-white/5 border-white/[0.09]",
        bubbleText: "text-foreground",
      };
    default:
      return {
        glow: "from-fuchsia-500/10 via-cyan-500/8 to-transparent",
        bubble: "bg-white/5 border-white/[0.09]",
        bubbleText: "text-foreground",
      };
  }
}

function usePanelArt(panel: Panel) {
  const styles = useMemo(() => toneStyles(panel.tone), [panel.tone]);
  const art = useMemo(() => {
    switch (panel.id) {
      case "p1":
        return {
          bg: "bg-gradient-to-br from-fuchsia-500/25 via-black/10 to-orange-500/20",
          halftone:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] bg-[size:10px_10px] opacity-25",
          action:
            "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.16)_0,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_12px)]",
          streaks:
            "bg-[linear-gradient(to_right,transparent_0%,rgba(236,72,153,0.22)_35%,transparent_70%)]",
          blob: "bg-gradient-to-br from-fuchsia-500/35 to-orange-500/25",
          badge: "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100",
          blobPos: "left-1/4 top-1/3 h-44 w-44",
        };
      case "p2":
        return {
          bg: "bg-gradient-to-br from-cyan-500/20 via-black/10 to-fuchsia-500/15",
          halftone:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.16)_1px,transparent_0)] bg-[size:12px_12px] opacity-20",
          action:
            "bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.14)_0,rgba(255,255,255,0.14)_1px,transparent_1px,transparent_10px)]",
          streaks:
            "bg-[linear-gradient(120deg,transparent_0%,rgba(34,211,238,0.20)_40%,transparent_75%)]",
          blob: "bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/20",
          badge: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
          blobPos: "left-1/3 top-1/4 h-52 w-52",
        };
      case "p3":
        return {
          bg: "bg-gradient-to-br from-slate-900/60 via-black/10 to-cyan-500/10",
          halftone:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.28)_1px,transparent_0)] bg-[size:9px_9px] opacity-25",
          action:
            "bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.18)_0,rgba(148,163,184,0.18)_1px,transparent_1px,transparent_14px)]",
          streaks:
            "bg-[radial-gradient(circle_at_80%_25%,rgba(34,211,238,0.18)_0%,transparent_55%)]",
          blob: "bg-gradient-to-br from-cyan-500/20 via-transparent to-white/10",
          badge: "border-slate-400/20 bg-white/5 text-foreground",
          blobPos: "left-1/6 top-1/3 h-56 w-56",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-white/10 via-fuchsia-500/10 to-cyan-500/10",
          halftone:
            "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] bg-[size:11px_11px] opacity-18",
          action:
            "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0,rgba(255,255,255,0.14)_1px,transparent_1px,transparent_11px)]",
          streaks:
            "bg-[linear-gradient(to_bottom,transparent_0%,rgba(236,72,153,0.20)_45%,transparent_85%)]",
          blob: "bg-gradient-to-br from-white/20 via-fuchsia-500/18 to-cyan-500/18",
          badge: "border-white/15 bg-white/5 text-foreground",
          blobPos: "left-1/4 top-1/5 h-56 w-56",
        };
    }
  }, [panel.id]);
  return { styles, art };
}

function PanelArtwork({
  panel,
  displayMode,
  aspectClassName,
}: {
  panel: Panel;
  displayMode: DisplayMode;
  /** Override default aspect / sizing for lightbox */
  aspectClassName?: string;
}) {
  const { styles, art } = usePanelArt(panel);
  const isColorMode = displayMode === "color";
  const imageSrc =
    panel.imageUrl?.trim() || comicPanelPlaceholderUrl(panel.panelIndex);
  const hasGeneratedImage = !isComicPanelPlaceholderImageUrl(panel.imageUrl);

  return (
    <div
      className={[
        aspectClassName ??
          "relative aspect-[4/3] w-full overflow-hidden rounded-2xl sm:rounded-3xl",
        "bg-black/20",
      ].join(" ")}
    >
      <img
        src={imageSrc}
        alt=""
        className={[
          "absolute inset-0 h-full w-full object-cover",
          isColorMode ? "" : "grayscale contrast-[1.02]",
        ].join(" ")}
        loading="lazy"
        decoding="async"
      />
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 bg-gradient-to-t via-black/5",
          hasGeneratedImage
            ? "from-black/25 to-black/10"
            : "from-black/55 to-black/20",
        ].join(" ")}
      />
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          hasGeneratedImage ? "opacity-[0.06]" : "opacity-[0.18]",
          styles.glow,
        ].join(" ")}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.09] sm:rounded-3xl"
      />
      <div className="absolute left-4 top-4 z-10">
        <div
          aria-hidden="true"
          className={[
            "rounded-full border px-3 py-1 text-[10px] font-semibold tracking-widest shadow-sm shadow-black/40",
            art.badge,
          ].join(" ")}
        >
          {isColorMode ? "FULL COLOR PREVIEW" : "B&W PREVIEW"}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {hasGeneratedImage ? "Generated panel" : "Panel artwork"}
      </div>
    </div>
  );
}

function PanelCard({
  panel,
  displayMode,
  onExpand,
}: {
  panel: Panel;
  displayMode: DisplayMode;
  onExpand: () => void;
}) {
  const { styles } = usePanelArt(panel);
  const hasGeneratedImage = !isComicPanelPlaceholderImageUrl(panel.imageUrl);

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.04]">
      <div className="relative">
        <div
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-0 bg-gradient-to-br",
            hasGeneratedImage ? "opacity-12" : "opacity-35",
            styles.glow,
          ].join(" ")}
        />
        <div className="relative">
          <PanelArtwork panel={panel} displayMode={displayMode} />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onExpand();
            }}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/55 text-foreground/95 shadow-lg backdrop-blur-md transition hover:bg-black/75 hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50"
            aria-label="Expand panel preview"
          >
            <ExpandPanelIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="text-xs font-semibold text-foreground/70">
          {panel.caption}
        </div>
        <div
          className={[
            "mt-3 rounded-2xl border px-3 py-2 text-sm leading-relaxed",
            styles.bubble,
            styles.bubbleText,
          ].join(" ")}
        >
          {panel.dialogue}
        </div>
      </div>
    </article>
  );
}

function PanelLightboxInner({
  panel,
  index,
  total,
  displayMode,
  onClose,
  onPrev,
  onNext,
}: {
  panel: Panel;
  index: number;
  total: number;
  displayMode: DisplayMode;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { styles } = usePanelArt(panel);
  const canPrev = index > 0;
  const canNext = index < total - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-8 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-lightbox-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0a0a0f]/88 backdrop-blur-sm"
        aria-label="Close panel preview"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0c0c12] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.09] px-4 py-3 sm:px-5">
          <p
            id="panel-lightbox-title"
            className="text-sm font-semibold text-foreground/90"
          >
            Panel {index + 1} of {total}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.09] bg-white/5 px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <PanelArtwork
              panel={panel}
              displayMode={displayMode}
              aspectClassName="relative aspect-[4/3] w-full max-h-[min(52vh,520px)] min-h-0 overflow-hidden rounded-2xl sm:rounded-3xl"
            />
          </div>
          <div className="mx-auto mt-6 w-full max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Caption
            </p>
            <p className="text-sm font-medium leading-relaxed text-foreground/85">
              {panel.caption}
            </p>
            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Dialogue
            </p>
            <div
              className={[
                "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
                styles.bubble,
                styles.bubbleText,
              ].join(" ")}
            >
              {panel.dialogue}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.09] bg-black/20 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            className="inline-flex h-11 min-w-[7rem] items-center justify-center rounded-full border border-white/[0.09] bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="inline-flex h-11 min-w-[7rem] items-center justify-center rounded-full border border-white/[0.09] bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelLightbox({
  open,
  panels,
  index,
  displayMode,
  onClose,
  onPrev,
  onNext,
}: {
  open: boolean;
  panels: Panel[];
  index: number;
  displayMode: DisplayMode;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!open) return null;
  const panel = panels[index];
  if (!panel) return null;
  return (
    <PanelLightboxInner
      panel={panel}
      index={index}
      total={panels.length}
      displayMode={displayMode}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
    />
  );
}

function ReaderStage({
  panel,
  displayMode,
  globalIndex,
  total,
  onPrev,
  onNext,
}: {
  panel: Panel;
  displayMode: DisplayMode;
  globalIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { styles } = usePanelArt(panel);
  const canPrev = globalIndex > 0;
  const canNext = globalIndex < total - 1;

  return (
    <div className="transition-opacity duration-300 ease-out">
      <div className="relative mx-auto w-full max-w-4xl">
        <PanelArtwork
          panel={panel}
          displayMode={displayMode}
          aspectClassName="relative aspect-[4/3] w-full max-h-[min(52vh,560px)] overflow-hidden rounded-2xl border border-white/[0.09] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.05] sm:rounded-3xl"
        />
      </div>
      <div className="mx-auto mt-8 max-w-2xl space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
            Caption
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-foreground/90">
            {panel.caption}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
            Dialogue
          </p>
          <div
            className={[
              "mt-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
              styles.bubble,
              styles.bubbleText,
            ].join(" ")}
          >
            {panel.dialogue}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-lg items-center justify-between gap-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="inline-flex h-11 min-w-[7.5rem] flex-1 items-center justify-center rounded-xl border border-white/[0.09] bg-white/5 px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="shrink-0 text-sm tabular-nums text-zinc-500">
          Panel {globalIndex + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="inline-flex h-11 min-w-[7.5rem] flex-1 items-center justify-center rounded-xl border border-white/[0.09] bg-white/5 px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const toolbarBtn =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold shadow-sm shadow-black/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/35";

export default function ComicPreviewClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [isExporting, setIsExporting] = useState(false);
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("bw");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [authModalPendingAction, setAuthModalPendingAction] =
    useState<PendingAuthAction | null>(null);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [showReplaceOption, setShowReplaceOption] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<null | (() => Promise<void>)>(null);
  /** Cloud project rows (free-tier limit UI); null = not loaded yet for authed free users. */
  const [cloudProjectsForLimit, setCloudProjectsForLimit] = useState<
    Array<{ id: string; title: string; format: StoryDraft["format"]; idea: string }> | null
  >(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pageIndex, setPageIndex] = useState(0);
  const [readerPanelIdx, setReaderPanelIdx] = useState(0);
  const pageExportRef = useRef<HTMLDivElement | null>(null);
  const resumeAuthActionHandled = useRef(false);

  useEffect(() => {
    setDraft(loadStoryDraftFromStorage());
    void fetchCurrentPlanTier().then(setPlanTier);
  }, []);

  useEffect(() => {
    if (!draft) return;
    const preferColor =
      draft.storyWorld.comicColorMode === "color" && planTier === "premium";
    setDisplayMode(preferColor ? "color" : "bw");
  }, [draft, planTier]);

  useEffect(() => {
    async function loadAuth() {
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
    void loadAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCloudProjectsForLimit(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/projects", { method: "GET" });
      if (cancelled) return;
      if (!res.ok) {
        setCloudProjectsForLimit([]);
        return;
      }
      const rows = (await res.json()) as Array<{
        id: string;
        title: string;
        format: StoryDraft["format"];
        idea: string;
      }>;
      setCloudProjectsForLimit(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          format: r.format,
          idea: r.idea,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const allPanels: Panel[] = useMemo(() => {
    if (!draft) return [];
    return draft.comicPanels.map((p, idx) => ({
      id: `p${(idx % 4) + 1}`,
      panelIndex: idx,
      caption: p.caption,
      dialogue: p.dialogue,
      tone: p.tone,
      imageUrl: p.imageUrl,
    }));
  }, [draft]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(allPanels.length / PANELS_PER_PAGE) || 1),
    [allPanels.length],
  );

  const currentPagePanels = useMemo(() => {
    const start = pageIndex * PANELS_PER_PAGE;
    return allPanels.slice(start, start + PANELS_PER_PAGE);
  }, [allPanels, pageIndex]);

  useEffect(() => {
    setPageIndex((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  useEffect(() => {
    setReaderPanelIdx((i) =>
      Math.min(i, Math.max(0, allPanels.length - 1)),
    );
  }, [allPanels.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const max = allPanels.length - 1;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) => (i !== null && i < max ? i + 1 : i));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, allPanels.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxIndex]);

  const STORAGE_KEY = "storyforge.projects";

  type SavedProject = StoryDraft & {
    id: string;
    createdAt: string;
  };

  function safeParseProjects(raw: string | null): SavedProject[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p) => {
        if (!p || typeof p !== "object") return false;
        const obj = p as Record<string, unknown>;
        return (
          typeof obj.id === "string" &&
          typeof obj.title === "string" &&
          typeof obj.format === "string" &&
          typeof obj.idea === "string" &&
          typeof obj.summary === "string" &&
          typeof obj.chapterPreview === "string" &&
          Array.isArray(obj.characters) &&
          Array.isArray(obj.comicPanels) &&
          typeof obj.createdAt === "string"
        );
      }) as SavedProject[];
    } catch {
      return [];
    }
  }

  const localLimitState = useMemo(() => {
    if (typeof window === "undefined" || !draft) return { count: 0, match: false };
    try {
      const existing = safeParseProjects(localStorage.getItem(STORAGE_KEY));
      const match = existing.some(
        (p) =>
          p.title === draft.title &&
          p.format === draft.format &&
          p.idea === draft.idea,
      );
      return { count: existing.length, match };
    } catch {
      return { count: 0, match: false };
    }
  }, [draft]);

  const cloudMatch = useMemo(() => {
    if (!draft || !cloudProjectsForLimit) return false;
    return cloudProjectsForLimit.some(
      (p) =>
        p.title === draft.title &&
        p.format === draft.format &&
        p.idea === draft.idea,
    );
  }, [draft, cloudProjectsForLimit]);

  const isEditingExistingSaved = Boolean(
    draft &&
      (isAuthenticated
        ? cloudProjectsForLimit !== null && cloudMatch
        : localLimitState.match),
  );

  /** STATE 3 (comic): authenticated free user at cloud save limit for a net-new story. */
  const freeTierLimitNewProjectLocked =
    isAuthenticated &&
    planTier === "free" &&
    Boolean(draft) &&
    cloudProjectsForLimit !== null &&
    cloudProjectsForLimit.length >= FREE_PLAN_MAX_SAVED_PROJECTS &&
    !cloudMatch;

  /** STATE 1: guest must sign in to save or export. */
  const comicActionsAuthLocked = !isAuthenticated && Boolean(draft);

  const openAuthRequiredModal = useCallback((action: PendingAuthAction) => {
    setAuthModalPendingAction(action);
    setShowAuthRequiredModal(true);
  }, []);

  const openFreeTierLimitModalWithReplace = useCallback(
    (kind: "save" | "export") => {
      if (!draft) return;
      setUpgradeReason(
        kind === "save"
          ? UPGRADE_MESSAGE_SAVE_PROJECT_LIMIT
          : UPGRADE_MESSAGE_BASIC_EXPORT_LIMIT,
      );
      setShowReplaceOption(true);
      setPendingReplace(() => async () => {
        if (!draft) return;
        if (isAuthenticated) {
          const listRes = await fetch("/api/projects", { method: "GET" });
          if (!listRes.ok) {
            const errJson = (await listRes.json().catch(() => null)) as
              | ProjectApiErrorBody
              | null;
            throw new Error(
              messageFromProjectApiError(
                errJson,
                "Could not load cloud projects.",
              ),
            );
          }
          const existing = (await listRes.json()) as Array<{
            id: string;
            title: string;
            format: StoryDraft["format"];
            idea: string;
          }>;
          const target = existing[0];
          if (!target) return;
          const replaceBody = {
            title: draft.title,
            format: draft.format,
            idea: draft.idea,
            summary: draft.summary,
            chapter_preview: draft.chapterPreview,
            characters: draft.characters,
            comic_panels: draft.comicPanels,
            story_world: draft.storyWorld,
            generation_mode: draft.generationMode ?? null,
          };
          const replaceRes = await fetch(`/api/projects/${target.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(replaceBody),
          });
          if (!replaceRes.ok) {
            const errJson = (await replaceRes.json().catch(() => null)) as
              | ProjectApiErrorBody
              | null;
            throw new Error(
              messageFromProjectApiError(
                errJson,
                "Could not replace existing project.",
              ),
            );
          }
          router.push("/dashboard?saved=cloud");
          return;
        }
        let existingLocal: SavedProject[] = [];
        try {
          existingLocal = safeParseProjects(localStorage.getItem(STORAGE_KEY));
        } catch {
          existingLocal = [];
        }
        if (existingLocal.length === 0) return;
        const replacement: SavedProject = {
          ...existingLocal[0],
          ...draft,
          id: existingLocal[0].id,
          createdAt: existingLocal[0].createdAt,
        };
        const next = [replacement, ...existingLocal.slice(1)];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        router.push("/dashboard");
      });
      setShowUpgradeModal(true);
    },
    [draft, isAuthenticated, router],
  );

  async function saveProject() {
    setSaveError(null);
    if (!draft) {
      setSaveError("No story draft available to save.");
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    try {
        const listRes = await fetch("/api/projects", { method: "GET" });
        if (!listRes.ok) {
          const errJson = (await listRes.json().catch(() => null)) as
            | ProjectApiErrorBody
            | null;
          throw new Error(
            messageFromProjectApiError(
              errJson,
              "Could not load cloud projects.",
            ),
          );
        }
        const existing = (await listRes.json()) as Array<{
          id: string;
          title: string;
          format: StoryDraft["format"];
          idea: string;
        }>;
        const match = existing.find(
          (p) =>
            p.title === draft.title &&
            p.format === draft.format &&
            p.idea === draft.idea,
        );
        const isNetNew = !match;
        if (
          planTier === "free" &&
          isNetNew &&
          existing.length >= FREE_PLAN_MAX_SAVED_PROJECTS
        ) {
          openFreeTierLimitModalWithReplace("save");
          return;
        }

        const body = {
          title: draft.title,
          format: draft.format,
          idea: draft.idea,
          summary: draft.summary,
          chapter_preview: draft.chapterPreview,
          characters: draft.characters,
          comic_panels: draft.comicPanels,
          story_world: draft.storyWorld,
          generation_mode: draft.generationMode ?? null,
        };

        const saveRes = await fetch(
          match ? `/api/projects/${match.id}` : "/api/projects",
          {
            method: match ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!saveRes.ok) {
          const errJson = (await saveRes.json().catch(() => null)) as
            | ProjectApiErrorBody
            | null;
          throw new Error(
            messageFromProjectApiError(
              errJson,
              "Could not save project to Supabase.",
            ),
          );
        }
        void trackAnalyticsEvent({
          event: "save_project",
          properties: {
            storage: "supabase",
            first_time: markFirstEvent("save_project"),
          },
        });
        router.push("/dashboard?saved=cloud");
        return;
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "Could not save project to Supabase.",
        );
        return;
      }
  }

  function onChangeDisplayMode(mode: DisplayMode) {
    if (mode === "color" && planTier !== "premium") {
      setUpgradeReason(UPGRADE_MESSAGE_FULL_COLOR);
      setShowReplaceOption(false);
      setPendingReplace(null);
      setShowUpgradeModal(true);
      return;
    }
    setDisplayMode(mode);
    if (!draft) return;
    const next = ensureDraftIntegrity({
      ...draft,
      storyWorld: {
        ...draft.storyWorld,
        comicColorMode: mode === "color" ? "color" : "bw",
      },
    });
    setDraft(next);
    saveStoryDraftToStorage(next);
  }

  function onRequestHDExport() {
    if (planTier !== "premium") {
      setUpgradeReason(UPGRADE_MESSAGE_HD_EXPORT);
      setShowReplaceOption(false);
      setPendingReplace(null);
      setShowUpgradeModal(true);
      return;
    }
  }

  function onRequestEditPage() {
    if (planTier !== "premium") {
      if (freeTierLimitNewProjectLocked && draft) {
        openFreeTierLimitModalWithReplace("save");
        return;
      }
      setUpgradeReason(UPGRADE_MESSAGE_EDIT_PAGE);
      setShowReplaceOption(false);
      setPendingReplace(null);
      setShowUpgradeModal(true);
      return;
    }
    router.push("/create");
  }

  function handleEditPageClick() {
    if (!draft) return;
    if (!isAuthenticated) {
      openAuthRequiredModal("edit_page");
      return;
    }
    onRequestEditPage();
  }

  async function exportCurrentPagePng(isHD: boolean) {
    if (!draft || !pageExportRef.current) {
      setExportError("Nothing to export yet.");
      return;
    }
    setExportError(null);
    setIsExporting(true);
    const wasReader = viewMode === "reader";
    if (wasReader) setViewMode("grid");
    await new Promise((r) => setTimeout(r, wasReader ? 220 : 0));
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(pageExportRef.current, {
        backgroundColor: "#09090f",
        scale: isHD ? 2.2 : 1,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const base = fileSlug(draft.title);
      const pageNum = pageIndex + 1;
      const filename = isHD
        ? `${base}-page-${pageNum}-hd.png`
        : `${base}-page-${pageNum}.png`;
      downloadDataUrl(dataUrl, filename);
      void trackAnalyticsEvent({
        event: "export",
        properties: {
          type: "png",
          quality: isHD ? "hd" : "basic",
          first_time: markFirstEvent("export"),
        },
      });
    } catch {
      setExportError("Failed to export PNG.");
    } finally {
      if (wasReader) setViewMode("reader");
      setIsExporting(false);
    }
  }

  async function exportFullStoryPdf() {
    if (!draft) {
      setExportError("Nothing to export yet.");
      return;
    }
    setExportError(null);
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const allPanels = draft.comicPanels;
      const chunks: typeof allPanels[] = [];
      for (let i = 0; i < allPanels.length; i += 4) {
        chunks.push(allPanels.slice(i, i + 4));
      }
      if (chunks.length === 0) chunks.push([]);

      chunks.forEach((pagePanels, pageIdx) => {
        if (pageIdx > 0) doc.addPage();

        const pageW = doc.internal.pageSize.getWidth();
        const margin = 36;
        const topY = 64;

        doc.setFillColor(10, 10, 16);
        doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

        doc.setTextColor(236, 236, 244);
        doc.setFontSize(16);
        doc.text(`${draft.title} - Page ${pageIdx + 1}`, margin, topY);

        const cardW = (pageW - margin * 2 - 12) / 2;
        const cardH = 220;
        const startY = topY + 18;

        pagePanels.forEach((panel, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = margin + col * (cardW + 12);
          const y = startY + row * (cardH + 14);

          doc.setDrawColor(130, 130, 160);
          doc.setFillColor(20, 20, 30);
          doc.roundedRect(x, y, cardW, cardH, 10, 10, "FD");

          doc.setFontSize(11);
          doc.setTextColor(200, 200, 215);
          doc.text(`Panel ${pageIdx * 4 + idx + 1}`, x + 12, y + 18);

          const caption = doc.splitTextToSize(panel.caption, cardW - 24);
          doc.setFontSize(10);
          doc.text(caption, x + 12, y + 38);

          const dialogue = doc.splitTextToSize(`"${panel.dialogue}"`, cardW - 24);
          doc.setFontSize(10);
          doc.text(dialogue, x + 12, y + 94);
        });
      });

      doc.save(`${fileSlug(draft.title)}-full.pdf`);
      void trackAnalyticsEvent({
        event: "export",
        properties: {
          type: "pdf",
          quality: "premium",
          first_time: markFirstEvent("export"),
        },
      });
    } catch {
      setExportError("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  const readerPanel = allPanels[readerPanelIdx];
  const canPrevPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  function goPrevPage() {
    setPageIndex((p) => {
      const np = Math.max(0, p - 1);
      setReaderPanelIdx(np * PANELS_PER_PAGE);
      return np;
    });
  }

  function goNextPage() {
    setPageIndex((p) => {
      const np = Math.min(pageCount - 1, p + 1);
      setReaderPanelIdx(np * PANELS_PER_PAGE);
      return np;
    });
  }

  function readerGoPrev() {
    setReaderPanelIdx((i) => {
      const n = Math.max(0, i - 1);
      setPageIndex(Math.floor(n / PANELS_PER_PAGE));
      return n;
    });
  }

  function readerGoNext() {
    setReaderPanelIdx((i) => {
      const n = Math.min(allPanels.length - 1, i + 1);
      setPageIndex(Math.floor(n / PANELS_PER_PAGE));
      return n;
    });
  }

  useEffect(() => {
    if (resumeAuthActionHandled.current) return;
    if (!isAuthenticated || !draft) return;
    const pending = drainAuthReturnContextAtDestination(pathname);
    if (!pending) return;
    resumeAuthActionHandled.current = true;
    if (pending === "save_project") {
      void saveProject();
      return;
    }
    if (pending === "basic_export") {
      window.setTimeout(() => {
        void exportCurrentPagePng(false);
      }, 140);
      return;
    }
    if (pending === "hd_export") {
      if (planTier !== "premium") {
        window.setTimeout(() => {
          onRequestHDExport();
        }, 0);
        return;
      }
      window.setTimeout(() => {
        void exportCurrentPagePng(true);
      }, 140);
      return;
    }
    if (pending === "edit_page") {
      window.setTimeout(() => {
        onRequestEditPage();
      }, 0);
    }
  }, [isAuthenticated, draft, pathname, planTier]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader action={{ href: "/character-preview", label: "Back" }} />

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="pt-2 sm:pt-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Comic Page Preview
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
            Your first generated manga/comic page.
          </p>

          <div
            className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            role="toolbar"
            aria-label="Comic preview options"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onChangeDisplayMode("bw")}
                className={[
                  toolbarBtn,
                  displayMode === "bw"
                    ? "border-white/20 bg-white/12 text-foreground"
                    : "border-white/10 bg-black/25 text-foreground/75 hover:bg-white/[0.06]",
                ].join(" ")}
              >
                Black &amp; White
              </button>
              <button
                type="button"
                title={planTier === "premium" ? undefined : "Premium feature"}
                onClick={() => onChangeDisplayMode("color")}
                className={[
                  toolbarBtn,
                  planTier === "premium"
                    ? displayMode === "color"
                      ? "border-transparent bg-gradient-to-r from-fuchsia-500/75 to-cyan-500/75 text-black shadow-[0_6px_20px_rgba(236,72,153,0.15)]"
                      : "border-white/10 bg-black/25 text-foreground/75 hover:bg-white/[0.06]"
                    : "cursor-not-allowed border-white/10 bg-black/20 text-foreground/45 opacity-70",
                ].join(" ")}
              >
                {planTier !== "premium" ? (
                  <LockIcon className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
                ) : null}
                Full Color
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setViewMode("grid");
                  setLightboxIndex(null);
                }}
                className={[
                  toolbarBtn,
                  viewMode === "grid"
                    ? "border-white/20 bg-white/12 text-foreground"
                    : "border-white/10 bg-black/25 text-foreground/75 hover:bg-white/[0.06]",
                ].join(" ")}
              >
                Grid View
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("reader");
                  setReaderPanelIdx(pageIndex * PANELS_PER_PAGE);
                  setLightboxIndex(null);
                }}
                disabled={!draft || allPanels.length === 0}
                className={[
                  toolbarBtn,
                  viewMode === "reader"
                    ? "border-white/20 bg-white/12 text-foreground"
                    : "border-white/10 bg-black/25 text-foreground/75 hover:bg-white/[0.06]",
                  !draft || allPanels.length === 0
                    ? "cursor-not-allowed opacity-50"
                    : "",
                ].join(" ")}
              >
                Reader View
              </button>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          {draft && allPanels.length > 0 ? (
            <div className="transition-opacity duration-300 ease-out">
              {viewMode === "grid" ? (
                <div
                  ref={pageExportRef}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  {currentPagePanels.map((p, i) => {
                    const globalIdx = pageIndex * PANELS_PER_PAGE + i;
                    return (
                      <PanelCard
                        key={`${pageIndex}-${globalIdx}-${p.id}`}
                        panel={p}
                        displayMode={displayMode}
                        onExpand={() => setLightboxIndex(globalIdx)}
                      />
                    );
                  })}
                </div>
              ) : (
                <>
                  <div
                    ref={pageExportRef}
                    className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] w-[960px] max-w-[100vw]"
                    aria-hidden
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {currentPagePanels.map((p, i) => (
                        <PanelCard
                          key={`export-${pageIndex}-${i}-${p.id}`}
                          panel={p}
                          displayMode={displayMode}
                          onExpand={() => {}}
                        />
                      ))}
                    </div>
                  </div>
                  {readerPanel ? (
                    <div className="transition-opacity duration-300 ease-out">
                      <ReaderStage
                        panel={readerPanel}
                        displayMode={displayMode}
                        globalIndex={readerPanelIdx}
                        total={allPanels.length}
                        onPrev={readerGoPrev}
                        onNext={readerGoNext}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-8 text-center shadow-inner shadow-black/20">
              <div className="text-sm font-semibold text-foreground/90">
                No draft found
              </div>
              <div className="mt-2 text-sm text-foreground/65">
                Generate a story first, then come back to preview.
              </div>
              <div className="mt-6">
                <Link
                  href="/create"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(236,72,153,0.18)] transition hover:brightness-110"
                >
                  Back to Create
                </Link>
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (comicActionsAuthLocked) {
                    openAuthRequiredModal("save_project");
                    return;
                  }
                  if (freeTierLimitNewProjectLocked) {
                    openFreeTierLimitModalWithReplace("save");
                    return;
                  }
                  setIsSaving(true);
                  try {
                    await saveProject();
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={!draft || (isSaving && isAuthenticated)}
                className={[
                  "inline-flex h-11 min-h-[2.75rem] min-w-[10.5rem] items-center justify-center rounded-xl px-5 text-sm font-semibold transition",
                  freeTierLimitNewProjectLocked || comicActionsAuthLocked
                    ? "cursor-not-allowed gap-2 border border-fuchsia-300/20 bg-fuchsia-500/[0.05] text-fuchsia-100/65 opacity-90"
                    : "border border-white/[0.09] bg-white/[0.06] text-foreground/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                {freeTierLimitNewProjectLocked ? (
                  <>
                    <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/55" />
                    Save Project
                  </>
                ) : comicActionsAuthLocked ? (
                  <>
                    <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/55" />
                    {isEditingExistingSaved ? "Save Changes" : "Save Project"}
                  </>
                ) : isSaving ? (
                  "Saving..."
                ) : isEditingExistingSaved ? (
                  "Save Changes"
                ) : (
                  "Save Project"
                )}
              </button>

              {planTier === "premium" ? (
                <button
                  type="button"
                  onClick={handleEditPageClick}
                  disabled={!draft}
                  className="inline-flex h-11 min-h-[2.75rem] min-w-[10.5rem] items-center justify-center rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/[0.08] px-5 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit Page
                </button>
              ) : (
                <button
                  type="button"
                  title={
                    comicActionsAuthLocked
                      ? "Sign in to continue"
                      : freeTierLimitNewProjectLocked
                        ? "Free plan limit — upgrade or replace"
                        : "Premium feature"
                  }
                  onClick={handleEditPageClick}
                  className="inline-flex h-11 min-h-[2.75rem] min-w-[10.5rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/[0.05] px-5 text-sm font-semibold text-fuchsia-100/65 opacity-90"
                >
                  <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/55" />
                  Edit Page
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
              <button
                type="button"
                disabled={
                  !draft ||
                  (!freeTierLimitNewProjectLocked &&
                    !comicActionsAuthLocked &&
                    isExporting)
                }
                onClick={() => {
                  if (comicActionsAuthLocked) {
                    openAuthRequiredModal("basic_export");
                    return;
                  }
                  if (freeTierLimitNewProjectLocked) {
                    openFreeTierLimitModalWithReplace("export");
                    return;
                  }
                  void exportCurrentPagePng(false);
                }}
                className={[
                  "inline-flex h-11 min-h-[2.75rem] min-w-[11.5rem] items-center justify-center rounded-xl px-6 text-sm font-semibold shadow-[0_8px_24px_rgba(236,72,153,0.18)] transition",
                  freeTierLimitNewProjectLocked || comicActionsAuthLocked
                    ? "cursor-not-allowed gap-2 border border-fuchsia-300/20 bg-fuchsia-500/[0.06] text-fuchsia-100/70 opacity-90"
                    : "bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                {freeTierLimitNewProjectLocked ? (
                  <>
                    <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/60" />
                    Basic Export (PNG)
                  </>
                ) : comicActionsAuthLocked ? (
                  <>
                    <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/60" />
                    Basic Export (PNG)
                  </>
                ) : isExporting ? (
                  "Exporting..."
                ) : (
                  "Basic Export (PNG)"
                )}
              </button>

              {planTier === "premium" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (comicActionsAuthLocked) {
                      openAuthRequiredModal("hd_export");
                      return;
                    }
                    void exportCurrentPagePng(true);
                  }}
                  disabled={isExporting || !draft}
                  className="inline-flex h-11 min-h-[2.75rem] min-w-[10.5rem] items-center justify-center rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/[0.08] px-5 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  HD Export (PNG)
                </button>
              ) : (
                <button
                  type="button"
                  title={
                    comicActionsAuthLocked
                      ? "Sign in to continue"
                      : "Premium feature"
                  }
                  onClick={() => {
                    if (comicActionsAuthLocked) {
                      openAuthRequiredModal("hd_export");
                      return;
                    }
                    onRequestHDExport();
                  }}
                  className="inline-flex h-11 min-h-[2.75rem] min-w-[10.5rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/[0.05] px-5 text-sm font-semibold text-fuchsia-100/65 opacity-90"
                >
                  <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/55" />
                  HD Export (PNG)
                </button>
              )}
            </div>
          </div>

          {planTier === "premium" && draft && allPanels.length > 0 ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  void exportFullStoryPdf();
                }}
                disabled={isExporting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-500/[0.08] px-5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Export Full Story (PDF)
              </button>
            </div>
          ) : null}

          {draft && allPanels.length > 0 && viewMode === "grid" ? (
            <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/[0.09] pt-8">
              <p className="text-sm tabular-nums text-foreground/60">
                Page {pageIndex + 1} of {pageCount}
              </p>
              <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  disabled={!canPrevPage}
                  onClick={goPrevPage}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous Page
                </button>
                <button
                  type="button"
                  disabled={!canNextPage}
                  onClick={goNextPage}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next Page
                </button>
              </div>
            </div>
          ) : null}

          {saveError ? (
            <p className="mt-4 text-sm text-fuchsia-200/90" aria-live="polite">
              {saveError}
            </p>
          ) : null}
          {exportError ? (
            <p className="mt-2 text-sm text-fuchsia-200/90" aria-live="polite">
              {exportError}
            </p>
          ) : null}
        </section>
      </main>

      <PanelLightbox
        open={lightboxIndex !== null}
        panels={allPanels}
        index={lightboxIndex ?? 0}
        displayMode={displayMode}
        onClose={() => setLightboxIndex(null)}
        onPrev={() =>
          setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))
        }
        onNext={() =>
          setLightboxIndex((i) =>
            i !== null && i < allPanels.length - 1 ? i + 1 : i,
          )
        }
      />

      <UpgradeModal
        open={showUpgradeModal}
        reason={upgradeReason}
        showReplaceAction={showReplaceOption}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          router.push("/pricing");
        }}
        onMaybeLater={() => {
          setShowUpgradeModal(false);
          setShowReplaceOption(false);
          setPendingReplace(null);
        }}
        onReplaceExistingProject={
          showReplaceOption && pendingReplace
            ? async () => {
                try {
                  await pendingReplace();
                  setShowUpgradeModal(false);
                } catch (e) {
                  setSaveError(
                    e instanceof Error ? e.message : "Could not replace project.",
                  );
                } finally {
                  setShowReplaceOption(false);
                  setPendingReplace(null);
                }
              }
            : undefined
        }
      />

      <AuthRequiredModal
        open={showAuthRequiredModal}
        onSignIn={() => {
          const action = authModalPendingAction;
          if (draft && action) {
            saveAuthReturnContext({
              returnPath: "/comic-preview",
              pendingAction: action,
              draft,
            });
          }
          setShowAuthRequiredModal(false);
          setAuthModalPendingAction(null);
          router.push("/login");
        }}
        onCreateAccount={() => {
          const action = authModalPendingAction;
          if (draft && action) {
            saveAuthReturnContext({
              returnPath: "/comic-preview",
              pendingAction: action,
              draft,
            });
          }
          setShowAuthRequiredModal(false);
          setAuthModalPendingAction(null);
          router.push("/signup");
        }}
        onMaybeLater={() => {
          setShowAuthRequiredModal(false);
          setAuthModalPendingAction(null);
        }}
      />
     </div>
   );
 }

