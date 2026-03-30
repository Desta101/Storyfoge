"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureDraftIntegrity,
  safeParseStoryDraft,
  saveStoryDraftToStorage,
  type StoryDraft,
  type StoryFormat,
} from "../../lib/storyDraft";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import AppHeader from "../../components/AppHeader";
import { markFirstEvent, trackAnalyticsEvent } from "../../lib/analytics";
import { fetchCurrentPlanTier, type PlanTier } from "../../lib/plan";
import {
  messageFromProjectApiError,
  type ProjectApiErrorBody,
} from "../../lib/projectApiClientMessage";
import ProjectStoryEditor from "./ProjectStoryEditor";

type Project = StoryDraft & {
  id: string;
  createdAt: string;
};

const STORAGE_KEY = "storyforge.projects";
const supabase = createSupabaseBrowserClient();

function safeParseProjects(raw: string | null): Project[] {
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
        typeof obj.createdAt === "string" &&
        (obj.format === "manga" || obj.format === "comic")
      );
    }) as Project[];
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function projectToDraft(p: Project): StoryDraft {
  return ensureDraftIntegrity({
    format: p.format,
    idea: p.idea,
    title: p.title,
    summary: p.summary,
    characters: p.characters,
    chapterPreview: p.chapterPreview,
    comicPanels: p.comicPanels,
    storyWorld: p.storyWorld,
    generationMode: p.generationMode,
  });
}

type ProjectApiRow = {
  id: string;
  title: string;
  format: StoryFormat;
  idea: string;
  summary: string;
  chapter_preview: string;
  characters: StoryDraft["characters"];
  comic_panels: StoryDraft["comicPanels"];
  story_world?: unknown;
  generation_mode?: StoryDraft["generationMode"] | null;
  created_at: string;
};

function mapApiRowToProject(row: ProjectApiRow): Project | null {
  const normalized = safeParseStoryDraft(
    JSON.stringify({
      format: row.format,
      idea: row.idea,
      title: row.title,
      summary: row.summary,
      chapterPreview: row.chapter_preview,
      characters: row.characters,
      comicPanels: row.comic_panels,
      storyWorld: row.story_world,
      generationMode: row.generation_mode ?? undefined,
    }),
  );
  if (!normalized) return null;
  return { ...normalized, id: row.id, createdAt: row.created_at };
}

export default function ProjectClient() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [editDraft, setEditDraft] = useState<StoryDraft | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const lastSavedSnapshotRef = useRef<string | null>(null);
  const cloudHydratedRef = useRef(false);
  const editDraftRef = useRef<StoryDraft | null>(null);
  editDraftRef.current = editDraft;

  const formatTag = useMemo(() => {
    const raw = editDraft?.format?.toLowerCase() ?? "";
    return raw.includes("manga") ? "Manga" : "Comic";
  }, [editDraft?.format]);

  useEffect(() => {
    void fetchCurrentPlanTier().then(setPlanTier);
  }, []);

  useEffect(() => {
    lastSavedSnapshotRef.current = null;
    cloudHydratedRef.current = false;
  }, [id]);

  useEffect(() => {
    async function loadProject() {
      if (!id) {
        setProject(null);
        setEditDraft(null);
        setIsLoading(false);
        return;
      }

      let authed = false;
      try {
        if (!supabase) {
          authed = false;
        } else {
          const { data } = await supabase.auth.getUser();
          authed = Boolean(data?.user);
        }
      } catch {
        authed = false;
      }
      setIsAuthenticated(authed);

      if (authed) {
        try {
          const res = await fetch(`/api/projects/${id}`);
          if (res.ok) {
            const row = (await res.json()) as ProjectApiRow;
            const mapped = mapApiRowToProject(row);
            if (mapped) {
              setProject(mapped);
              setEditDraft(projectToDraft(mapped));
            }
            setIsLoading(false);
            return;
          }
        } catch {
          // Fall through to local fallback.
        }
      }

      let loaded: Project[] = [];
      try {
        loaded = safeParseProjects(localStorage.getItem(STORAGE_KEY));
      } catch {
        loaded = [];
      }
      const found = loaded.find((p) => p.id === id) ?? null;
      if (found) {
        const { id: pid, createdAt, ...rest } = found;
        const normalized = safeParseStoryDraft(JSON.stringify(rest));
        if (normalized) {
          const withWorld: Project = { ...normalized, id: pid, createdAt };
          setProject(withWorld);
          setEditDraft(projectToDraft(withWorld));
          void trackAnalyticsEvent({
            event: "project_opened",
            properties: {
              source: "local",
              project_id: withWorld.id,
              first_time: markFirstEvent("project_opened"),
            },
          });
        } else {
          setProject(null);
          setEditDraft(null);
        }
      } else {
        setProject(null);
        setEditDraft(null);
      }
      setIsLoading(false);
    }

    void loadProject();
  }, [id]);

  useEffect(() => {
    if (!editDraft || !project) return;
    saveStoryDraftToStorage(editDraft);
  }, [editDraft, project]);

  useEffect(() => {
    if (!editDraft || !project || isLoading) return;
    if (!isAuthenticated) {
      cloudHydratedRef.current = false;
      return;
    }
    if (!cloudHydratedRef.current) {
      lastSavedSnapshotRef.current = JSON.stringify(ensureDraftIntegrity(editDraft));
      cloudHydratedRef.current = true;
    }
  }, [editDraft, project, isLoading, isAuthenticated]);

  const persistDraftToCloud = useCallback(
    async (draft: StoryDraft) => {
      const pid = project?.id;
      if (!pid || !isAuthenticated) return;
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const res = await fetch(`/api/projects/${pid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            idea: draft.idea,
            format: draft.format,
            summary: draft.summary,
            chapter_preview: draft.chapterPreview,
            characters: draft.characters,
            comic_panels: draft.comicPanels,
            story_world: draft.storyWorld,
            generation_mode: draft.generationMode ?? null,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as
            | ProjectApiErrorBody
            | null;
          throw new Error(
            messageFromProjectApiError(err, "Could not save project."),
          );
        }
        const row = (await res.json()) as ProjectApiRow;
        const mapped = mapApiRowToProject(row);
        if (!mapped) throw new Error("Invalid server response.");
        const nextDraft = projectToDraft(mapped);
        setProject(mapped);
        setEditDraft(nextDraft);
        lastSavedSnapshotRef.current = JSON.stringify(ensureDraftIntegrity(nextDraft));
        router.refresh();
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (e) {
        setSaveStatus("error");
        setSaveError(e instanceof Error ? e.message : "Save failed.");
      }
    },
    [project?.id, isAuthenticated, router],
  );

  useEffect(() => {
    if (!id || !editDraft || !project || !isAuthenticated || isLoading) return;
    if (!cloudHydratedRef.current) return;

    const snap = JSON.stringify(ensureDraftIntegrity(editDraft));
    if (snap === lastSavedSnapshotRef.current) return;

    const t = setTimeout(() => {
      const current = editDraftRef.current;
      if (!current || !project) return;
      const snap2 = JSON.stringify(ensureDraftIntegrity(current));
      if (snap2 === lastSavedSnapshotRef.current) return;
      void persistDraftToCloud(current);
    }, 1600);

    return () => clearTimeout(t);
  }, [editDraft, id, project, isAuthenticated, isLoading, persistDraftToCloud]);

  async function saveToCloudManual() {
    const d = editDraftRef.current;
    if (!d || !project || !isAuthenticated) return;
    await persistDraftToCloud(d);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader action={{ href: "/dashboard", label: "Back to Dashboard" }} />

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          {isLoading ? (
            <div>
              <div className="h-10 w-56 animate-pulse rounded bg-white/5" />
              <div className="mt-4 h-4 w-72 animate-pulse rounded bg-white/5" />
              <div className="mt-8 h-40 w-full animate-pulse rounded bg-white/5" />
            </div>
          ) : project && editDraft ? (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {editDraft.title}
                  </h1>
                  <p className="mt-2 text-sm text-foreground/70">
                    Created {formatDate(project.createdAt)}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-foreground">
                    {formatTag}
                  </div>
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => void saveToCloudManual()}
                      disabled={saveStatus === "saving"}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {saveStatus === "saving"
                        ? "Saving…"
                        : saveStatus === "saved"
                          ? "Saved"
                          : "Save to cloud"}
                    </button>
                  ) : null}
                </div>
              </div>

              {saveStatus === "saved" ? (
                <p className="mt-3 text-xs text-emerald-300/90" aria-live="polite">
                  All changes saved to your account.
                </p>
              ) : null}
              {saveError ? (
                <p className="mt-3 text-sm text-red-300/90" aria-live="assertive">
                  {saveError}
                </p>
              ) : null}

              <ProjectStoryEditor
                value={editDraft}
                planTier={planTier}
                onUserDraftChange={setEditDraft}
              />

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!editDraft}
                  onClick={() => {
                    if (!editDraft) return;
                    saveStoryDraftToStorage(editDraft);
                    router.push("/story-preview");
                  }}
                >
                  Continue to Story Preview
                </button>

                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!editDraft}
                  onClick={() => {
                    if (!editDraft) return;
                    saveStoryDraftToStorage(editDraft);
                    router.push("/character-preview");
                  }}
                >
                  Continue to Character Preview
                </button>

                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!editDraft}
                  onClick={() => {
                    if (!editDraft) return;
                    saveStoryDraftToStorage(editDraft);
                    router.push("/comic-preview");
                  }}
                >
                  Continue to Comic Preview
                </button>
              </div>

              {isAuthenticated ? (
                <p className="mt-4 text-xs text-foreground/60">
                  Loaded from your Supabase projects. Changes save automatically to your
                  account; previews use the story draft in this browser.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground/90">
                Project not found
              </div>
              <div className="mt-2 text-sm text-foreground/70">
                This project may have been deleted, or the local storage data is
                unavailable.
              </div>
              <div className="mt-6">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
