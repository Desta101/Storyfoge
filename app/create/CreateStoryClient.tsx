"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGeminiQuotaCooldown } from "../hooks/useGeminiQuotaCooldown";
import { useGenerateStory } from "../hooks/useGenerateStory";
import AppHeader from "../components/AppHeader";
import UpgradeModal from "../components/UpgradeModal";
import {
  loadStoryDraftFromStorage,
  saveStoryDraftToStorage,
  type StoryDraft,
  type StoryFormat,
} from "../lib/storyDraft";
import { drainAuthReturnContextAtDestination } from "../lib/authReturn";
import { markFirstEvent, trackAnalyticsEvent } from "../lib/analytics";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import {
  FREE_PLAN_MAX_SAVED_PROJECTS,
  fetchCurrentPlanTier,
  type PlanTier,
} from "../lib/plan";
import {
  UPGRADE_MESSAGE_CREATE_NEW_PROJECT_LIMIT,
  UPGRADE_MODAL_DEFAULT_TITLE,
} from "../lib/upgradeCopy";

const supabase = createSupabaseBrowserClient();

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

type SavedProjectRow = {
  id: string;
  title: string;
  format: StoryFormat;
  idea: string;
};

type StoryType = StoryFormat;
const CREATE_FORM_SESSION_KEY = "storyforge.createForm";
const CREATE_FORM_LOCAL_KEY = "storyforge.createFormLocal";

type CreateFormDraft = {
  format: StoryType;
  idea: string;
};

function safeParseCreateFormDraft(raw: string | null): CreateFormDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "format" in parsed &&
      "idea" in parsed &&
      (parsed.format === "manga" || parsed.format === "comic") &&
      typeof parsed.idea === "string"
    ) {
      return { format: parsed.format, idea: parsed.idea };
    }
  } catch {
    // ignore invalid storage payloads
  }
  return null;
}

function loadCreateFormDraftFromStorage(): CreateFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = safeParseCreateFormDraft(
      sessionStorage.getItem(CREATE_FORM_SESSION_KEY),
    );
    if (fromSession) return fromSession;
  } catch {
    // ignore
  }

  try {
    const fromLocal = safeParseCreateFormDraft(
      localStorage.getItem(CREATE_FORM_LOCAL_KEY),
    );
    if (fromLocal) return fromLocal;
  } catch {
    // ignore
  }

  return null;
}

function saveCreateFormDraftToStorage(draft: CreateFormDraft) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(draft);
  try {
    sessionStorage.setItem(CREATE_FORM_SESSION_KEY, serialized);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(CREATE_FORM_LOCAL_KEY, serialized);
  } catch {
    // ignore
  }
}

 function Card({
   label,
   value,
   selected,
   onSelect,
 }: {
   label: string;
   value: StoryType;
   selected: boolean;
   onSelect: (v: StoryType) => void;
 }) {
   const ring = useMemo(
     () =>
       selected
         ? "border-fuchsia-400/40 bg-white/10 shadow-[0_0_0_1px_rgba(217,70,239,0.25)]"
         : "border-white/10 bg-white/5 hover:bg-white/10",
     [selected],
   );

   return (
     <button
       type="button"
       onClick={() => onSelect(value)}
       onKeyDown={(e) => {
         if (e.key === "Enter" || e.key === " ") onSelect(value);
       }}
       className={[
         "group flex min-h-[130px] flex-1 flex-col items-start justify-between rounded-3xl border p-6 text-left transition",
         ring,
       ].join(" ")}
       aria-pressed={selected}
     >
       <div className="flex w-full items-center justify-between gap-4">
         <div>
           <div className="text-lg font-semibold tracking-tight">{label}</div>
           <div className="mt-1 text-sm text-foreground/70">
             {value === "manga"
               ? "Panel-ready manga scenes"
               : "Comic pages with cinematic flow"}
           </div>
         </div>

         <div
           className={[
             "grid h-10 w-10 place-items-center rounded-2xl border text-sm font-semibold transition",
             selected
               ? "border-fuchsia-300/30 bg-fuchsia-500/15 text-fuchsia-200"
               : "border-white/10 bg-white/5 text-foreground/70 group-hover:bg-white/10",
           ].join(" ")}
         >
           {value === "manga" ? "Ｍ" : "Ｃ"}
         </div>
       </div>

       <div className="text-xs font-medium text-foreground/60">
         {selected ? "Selected" : "Click to select"}
       </div>
     </button>
   );
 }

 export default function CreateStoryClient() {
  const router = useRouter();
  const pathname = usePathname();
   const [storyType, setStoryType] = useState<StoryType>("manga");
   const [idea, setIdea] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<SavedProjectRow[] | null>(
    null,
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const {
    isGenerating,
    error: generateError,
    clearError: clearGenerateError,
    generateStory,
  } = useGenerateStory({ timeoutMs: 50_000 });

  const [quotaDraft, setQuotaDraft] = useState<StoryDraft | null>(null);
  useEffect(() => {
    setQuotaDraft(loadStoryDraftFromStorage());
  }, [pathname]);

  const quotaCooldownReason =
    quotaDraft?.generationMode === "mock" &&
    (quotaDraft.generationMockReason === "gemini_free_quota" ||
      quotaDraft.generationMockReason === "rate_limit")
      ? quotaDraft.generationMockReason
      : undefined;

  const { quotaCooldownActive, quotaSecondsLeft } = useGeminiQuotaCooldown({
    generationMockReason: quotaCooldownReason,
    generationRetryAfterMs:
      quotaCooldownReason != null
        ? quotaDraft?.generationRetryAfterMs
        : undefined,
  });

  const trimmedIdea = idea.trim();
  const formatSelected = storyType === "manga" || storyType === "comic";
  const canGenerate = formatSelected && trimmedIdea.length > 0;

  const validationMessage = !formatSelected
    ? "Please choose Manga or Comic."
    : trimmedIdea.length === 0
      ? "Describe your story idea before generating."
      : "";

  const didTrackCreatePage = useRef(false);
  const resumeGenerateHandled = useRef(false);

  const persistCreateForm = useCallback((format: StoryType, nextIdea: string) => {
    saveCreateFormDraftToStorage({ format, idea: nextIdea });
  }, []);

  // Load before paint so the textarea isn't briefly empty; avoids losing edits when navigating back quickly.
  useLayoutEffect(() => {
    const savedForm = loadCreateFormDraftFromStorage();
    if (savedForm) {
      setStoryType(savedForm.format);
      setIdea(savedForm.idea);
      return;
    }

    const existingDraft = loadStoryDraftFromStorage();
    if (existingDraft?.idea) {
      setStoryType(existingDraft.format);
      setIdea(existingDraft.idea);
    }
  }, []);

  useEffect(() => {
    if (didTrackCreatePage.current) return;
    didTrackCreatePage.current = true;
    void trackAnalyticsEvent({ event: "create_page_viewed" });
  }, []);

  useEffect(() => {
    void fetchCurrentPlanTier().then(setPlanTier);
  }, []);

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
    if (!isAuthenticated || planTier !== "free") {
      setCloudProjects(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/projects", { method: "GET" });
      if (cancelled) return;
      if (!res.ok) {
        setCloudProjects([]);
        return;
      }
      const rows = (await res.json()) as Array<{
        id: string;
        title: string;
        format: StoryFormat;
        idea: string;
      }>;
      setCloudProjects(
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
  }, [isAuthenticated, planTier]);

  useEffect(() => {
    if (resumeGenerateHandled.current) return;
    if (!canGenerate) return;
    const pending = drainAuthReturnContextAtDestination(pathname);
    if (pending !== "generate_story") return;
    resumeGenerateHandled.current = true;
    void (async () => {
      clearGenerateError();
      const result = await generateStory({
        format: storyType,
        idea,
      });
      if (!result.ok) {
        resumeGenerateHandled.current = false;
        return;
      }
      const parsed = result.draft;
      saveStoryDraftToStorage(parsed);
      persistCreateForm(parsed.format, parsed.idea);
      void trackAnalyticsEvent({
        event: "create_story",
        properties: {
          format: parsed.format,
          generation_mode: parsed.generationMode ?? "ai",
          first_time: markFirstEvent("create_story"),
        },
      });
      router.push("/story-preview");
    })();
  }, [
    canGenerate,
    pathname,
    storyType,
    idea,
    generateStory,
    clearGenerateError,
    router,
    persistCreateForm,
  ]);

  const workspaceDraft = useMemo(
    () => loadStoryDraftFromStorage(),
    [storyType, idea],
  );
  const titleForMatch = workspaceDraft?.title ?? "";

  /** Cloud-only: used for free-tier “1 saved project” cap (guests never hit this). */
  const matchesExistingSavedProject = useMemo(() => {
    if (!isAuthenticated) return false;
    const list = cloudProjects ?? [];
    if (list.length === 0) return false;
    return list.some(
      (p) =>
        p.title === titleForMatch &&
        p.format === storyType &&
        p.idea === trimmedIdea,
    );
  }, [
    isAuthenticated,
    cloudProjects,
    titleForMatch,
    storyType,
    trimmedIdea,
  ]);

  /** STATE 3: authenticated free user who already has a saved project (new net-new story). */
  const freeTierCreateLocked =
    isAuthenticated &&
    planTier === "free" &&
    cloudProjects !== null &&
    cloudProjects.length >= FREE_PLAN_MAX_SAVED_PROJECTS &&
    !matchesExistingSavedProject;

   return (
     <div className="min-h-screen bg-background text-foreground">
      <AppHeader action={{ href: "/", label: "Back" }} />

       <main className="mx-auto w-full max-w-6xl px-6 pb-16">
         <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
           <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
             <div>
               <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                 Create Your Story
               </h1>
               <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
                 Choose a format, describe your idea, and generate a starting
                 point.
               </p>
             </div>

             <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground/80">
               <span className="h-2 w-2 rounded-full bg-fuchsia-300/80" />
               AI format:{" "}
               <span className="font-semibold text-foreground">
                 {storyType === "manga" ? "Manga" : "Comic"}
               </span>
             </div>
           </div>

           <div className="mt-8 grid gap-4 lg:grid-cols-2">
             <Card
               label="Manga"
               value="manga"
               selected={storyType === "manga"}
               onSelect={(v) => {
                 setStoryType(v);
                 persistCreateForm(v, idea);
               }}
             />
             <Card
               label="Comic"
               value="comic"
               selected={storyType === "comic"}
               onSelect={(v) => {
                 setStoryType(v);
                 persistCreateForm(v, idea);
               }}
             />
           </div>

           <div className="mt-8">
             <label
               htmlFor="idea"
               className="text-sm font-medium text-foreground/80"
             >
               Story idea
             </label>
             <textarea
               id="idea"
               value={idea}
               onChange={(e) => {
                 const v = e.target.value;
                 setIdea(v);
                 persistCreateForm(storyType, v);
               }}
               placeholder="Describe your story idea..."
               rows={5}
               className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/40 outline-none transition focus:border-fuchsia-400/40"
             />
             <div className="mt-2 text-xs text-foreground/60">
               Tip: Include genre, setting, and what you want to happen in
               the first scene.
             </div>
           </div>

           <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
             {freeTierCreateLocked ? (
               <button
                 type="button"
                 title="Upgrade to create and save more projects"
                 onClick={() => setShowUpgradeModal(true)}
                 className="inline-flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-500/[0.06] px-7 text-sm font-semibold text-fuchsia-100/70 opacity-90 shadow-sm shadow-black/20"
               >
                 <LockIcon className="h-4 w-4 shrink-0 text-fuchsia-200/60" />
                 Generate Story
               </button>
             ) : (
               <button
                 type="button"
                 className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-7 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                 disabled={!canGenerate || isGenerating || quotaCooldownActive}
                 aria-disabled={
                   !canGenerate || isGenerating || quotaCooldownActive
                 }
                 onClick={async () => {
                   clearGenerateError();
                   const result = await generateStory({
                     format: storyType,
                     idea,
                   });
                   if (!result.ok) return;
                   const parsed = result.draft;
                   saveStoryDraftToStorage(parsed);
                   persistCreateForm(parsed.format, parsed.idea);
                   void trackAnalyticsEvent({
                     event: "create_story",
                     properties: {
                       format: parsed.format,
                       generation_mode: parsed.generationMode ?? "ai",
                       first_time: markFirstEvent("create_story"),
                     },
                   });
                   router.push("/story-preview");
                 }}
               >
                 {isGenerating ? "Generating..." : "Generate Story"}
               </button>
             )}

             <div className="text-sm text-foreground/70">
               Selected:{" "}
               <span className="font-semibold text-foreground">
                 {storyType === "manga" ? "Manga" : "Comic"}
               </span>
             </div>
           </div>

           {!isGenerating && !canGenerate ? (
             <p
               className="mt-3 text-sm text-fuchsia-200/90"
               aria-live="polite"
             >
               {validationMessage}
             </p>
           ) : null}

           {generateError ? (
             <p className="mt-3 text-sm text-fuchsia-200/90" aria-live="polite">
               {generateError}
             </p>
           ) : null}

           {quotaCooldownActive && quotaSecondsLeft > 0 ? (
             <p className="mt-3 text-sm text-fuchsia-200/90" aria-live="polite">
               {quotaCooldownReason === "gemini_free_quota"
                 ? "Gemini free quota reached. Please wait and try again."
                 : "Too many requests were sent in a short time. Please wait."}{" "}
               ({quotaSecondsLeft}s)
             </p>
           ) : null}
         </section>
       </main>

       <UpgradeModal
         open={showUpgradeModal}
         title={UPGRADE_MODAL_DEFAULT_TITLE}
         reason={UPGRADE_MESSAGE_CREATE_NEW_PROJECT_LIMIT}
         onUpgrade={() => {
           setShowUpgradeModal(false);
           router.push("/pricing");
         }}
         onMaybeLater={() => setShowUpgradeModal(false)}
       />
     </div>
   );
 }

