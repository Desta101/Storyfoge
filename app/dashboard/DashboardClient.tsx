 "use client";

 import Link from "next/link";
 import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import AppHeader from "../components/AppHeader";
import { trackAnalyticsEvent } from "../lib/analytics";
import {
  messageFromProjectApiError,
  type ProjectApiErrorBody,
} from "../lib/projectApiClientMessage";

 type Project = {
   id: string;
   title: string;
  format: "manga" | "comic" | string;
   createdAt: string;
   summary: string;
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
         typeof obj.createdAt === "string" &&
         typeof obj.summary === "string"
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

function ProjectCard({
  project,
  onRenameStart,
  onDeleteStart,
  menuOpen,
  onMenuToggle,
  onMenuClose,
}: {
  project: Project;
  onRenameStart: () => void;
  onDeleteStart: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
}) {
   const formatTag = useMemo(() => {
     const raw = project.format.toLowerCase();
     return raw.includes("manga") ? "Manga" : "Comic";
   }, [project.format]);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6">
       <div
         aria-hidden="true"
         className={[
           "pointer-events-none absolute inset-0 opacity-70",
           project.format.toLowerCase().includes("manga")
             ? "bg-[radial-gradient(circle_at_20%_10%,rgba(217,70,239,0.25),transparent_55%)]"
             : "bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_55%)]",
         ].join(" ")}
       />

      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <>
              <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight break-words">
                {project.title}
              </h3>
              <div className="mt-2 text-xs font-semibold text-foreground/70">
                {formatDate(project.createdAt)}
              </div>
            </>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-foreground">
              {formatTag}
            </div>

            <div
              className="relative"
              data-project-menu={project.id}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={onMenuToggle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
                title="Project actions"
              >
                ⋯
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-2xl border border-white/10 bg-black/80 backdrop-blur"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onMenuClose();
                      onRenameStart();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
                  >
                    Rename Project
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onMenuClose();
                      onDeleteStart();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-fuchsia-200/90 transition hover:bg-white/10"
                  >
                    Delete Project
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

         <p className="mt-4 text-sm leading-relaxed text-foreground/80">
           {project.summary}
         </p>

         <div className="mt-5">
           <Link
            href={`/project/${project.id}`}
             className="inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 sm:w-auto"
           >
             Open Project
           </Link>
         </div>
       </div>
     </article>
   );
 }

const FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "manga", label: "Manga" },
  { key: "comic", label: "Comic" },
] as const;

function DashboardTopControlsRow({
  searchQuery,
  onSearchChange,
  formatFilter,
  onFormatFilterChange,
  className = "",
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  formatFilter: "all" | "manga" | "comic";
  onFormatFilterChange: (value: "all" | "manga" | "comic") => void;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:gap-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="search"
    >
      <div className="flex h-11 min-w-0 w-full flex-1 items-center overflow-hidden rounded-full border border-white/10 bg-black/20 px-4 text-sm text-foreground/80 sm:min-w-0 sm:max-w-2xl lg:max-w-[min(100%,36rem)]">
        <span className="mr-2 shrink-0 text-xs text-foreground/60">Search</span>
        <input
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search projects by title"
        />
      </div>
      <div
        className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
        aria-label="Filter by format"
      >
        {FILTER_CHIPS.map((chip) => {
          const active = formatFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFormatFilterChange(chip.key)}
              className={[
                "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition",
                active
                  ? "border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-500/40 to-cyan-500/40 text-black shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                  : "border-white/10 bg-black/20 text-foreground/80 hover:bg-white/10",
              ].join(" ")}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

 export default function DashboardClient() {
  const searchParams = useSearchParams();
   const [projects, setProjects] = useState<Project[]>([]);
   const [isLoading, setIsLoading] = useState(true);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | "manga" | "comic">(
    "all",
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    void trackAnalyticsEvent({ event: "dashboard_viewed" });
  }, []);

  function persistProjects(next: Project[]) {
    setActionError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setProjects(next);
    } catch {
      setActionError("Could not update projects in localStorage.");
    }
  }

   useEffect(() => {
    const saved = searchParams.get("saved");
    if (saved === "cloud") {
      setSaveToast("Project saved to cloud successfully.");
    }
    if (saved === "local") {
      setSaveToast("Project saved locally.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!saveToast) return;
    const t = setTimeout(() => setSaveToast(null), 2800);
    return () => clearTimeout(t);
  }, [saveToast]);

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 2800);
    return () => clearTimeout(t);
  }, [actionToast]);

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);
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
          const res = await fetch("/api/projects", { method: "GET" });
          if (!res.ok) throw new Error("Failed to load cloud projects.");
          const rows = (await res.json()) as Array<{
            id: string;
            title: string;
            format: "manga" | "comic";
            summary: string;
            created_at: string;
          }>;
          setProjects(
            rows.map((row) => ({
              id: row.id,
              title: row.title,
              format: row.format,
              summary: row.summary,
              createdAt: row.created_at,
            })),
          );
          setIsLoading(false);
          return;
        } catch {
          setActionError("Could not load Supabase projects.");
        }
      }

      let loaded: Project[] = [];
      try {
        loaded = safeParseProjects(localStorage.getItem(STORAGE_KEY));
      } catch {
        loaded = [];
      }
      setProjects(loaded);
      setIsLoading(false);
    }

    void loadProjects();
   }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const host = target.closest(`[data-project-menu="${openMenuId}"]`);
      if (!host) setOpenMenuId(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openMenuId]);

  function beginRename(project: Project) {
    setActionError(null);
    setOpenMenuId(null);
    setRenameId(project.id);
    setRenameValue(project.title);
  }

  function cancelRename() {
    setRenameId(null);
    setRenameValue("");
  }

  async function saveRename() {
    if (!renameId) return;
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      setActionError("Project title cannot be empty.");
      return;
    }

    setIsMutating(true);
    try {
      if (isAuthenticated) {
        const res = await fetch(`/api/projects/${renameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as
            | ProjectApiErrorBody
            | null;
          throw new Error(
            messageFromProjectApiError(
              err,
              "Could not rename project in Supabase.",
            ),
          );
        }
        setProjects((current) =>
          current.map((p) => (p.id === renameId ? { ...p, title: nextTitle } : p)),
        );
        setActionToast("Project renamed.");
      } else {
        const next = projects.map((p) =>
          p.id === renameId ? { ...p, title: nextTitle } : p,
        );
        persistProjects(next);
        setActionToast("Project renamed.");
      }
      cancelRename();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setIsMutating(false);
    }
  }

  function requestDelete(projectId: string) {
    setActionError(null);
    setOpenMenuId(null);
    setDeleteConfirmId(projectId);
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    setIsMutating(true);
    try {
      if (isAuthenticated) {
        const res = await fetch(`/api/projects/${deleteConfirmId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as
            | ProjectApiErrorBody
            | null;
          throw new Error(
            messageFromProjectApiError(
              err,
              "Could not delete project from Supabase.",
            ),
          );
        }
        setProjects((current) => current.filter((p) => p.id !== deleteConfirmId));
        setActionToast("Project deleted.");
      } else {
        const next = projects.filter((p) => p.id !== deleteConfirmId);
        persistProjects(next);
        setActionToast("Project deleted.");
      }
      setDeleteConfirmId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setIsMutating(false);
    }
  }

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const matchTitle = q
        ? p.title.toLowerCase().includes(q)
        : true;
      const format = p.format.toLowerCase();
      const matchFormat =
        formatFilter === "all" ? true : format.includes(formatFilter);
      return matchTitle && matchFormat;
    });
  }, [projects, searchQuery, formatFilter]);

   return (
     <>
       <div className="min-h-screen bg-background text-foreground">
      <AppHeader action={{ href: "/create", label: "New Project" }} />

       <main className="mx-auto w-full max-w-[1400px] px-6 pb-20 sm:px-8 lg:px-10">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-12 lg:p-14">
            {!isLoading && projects.length === 0 ? (
              <>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                    My Projects
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
                    Your saved StoryForge drafts stored in this browser.
                  </p>
                </div>

                <DashboardTopControlsRow
                  className="mt-6 sm:mt-8"
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  formatFilter={formatFilter}
                  onFormatFilterChange={setFormatFilter}
                />

                <div className="mt-10 sm:mt-14">
                  <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/25 px-6 py-14 text-center sm:px-10 sm:py-16 lg:py-20">
                    <div className="mx-auto max-w-lg text-lg font-semibold text-foreground/95 sm:text-xl">
                      No saved projects yet.
                    </div>
                    <div className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
                      {isAuthenticated
                        ? "You don't have any cloud projects yet. Save one from Comic Preview to get started."
                        : "Create a comic page first, then save it to see it here."}
                    </div>
                    <div className="mt-10 sm:mt-12">
                      <Link
                        href="/create"
                        className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-8 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 sm:h-14 sm:text-base"
                      >
                        Create New Story
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                    My Projects
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
                    Your saved StoryForge drafts stored in this browser.
                  </p>
                </div>

                <DashboardTopControlsRow
                  className="mt-6 sm:mt-8"
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  formatFilter={formatFilter}
                  onFormatFilterChange={setFormatFilter}
                />

                {isLoading ? (
                  <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={`skeleton-${i}`}
                        className="h-[210px] animate-pulse rounded-3xl border border-white/10 bg-white/5"
                      />
                    ))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="mt-12 rounded-3xl border border-white/10 bg-black/20 px-6 py-12 text-center sm:py-14">
                    <div className="text-base font-semibold text-foreground/90 sm:text-lg">
                      No projects match your filters.
                    </div>
                    <div className="mt-3 text-sm text-foreground/70 sm:text-base">
                      Try changing the search or format filter.
                    </div>
                  </div>
                ) : (
                  <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                    {filteredProjects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        onRenameStart={() => beginRename(p)}
                        onDeleteStart={() => requestDelete(p.id)}
                        menuOpen={openMenuId === p.id}
                        onMenuToggle={() =>
                          setOpenMenuId((cur) => (cur === p.id ? null : p.id))
                        }
                        onMenuClose={() => setOpenMenuId(null)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
         </section>
       </main>
       </div>

      {saveToast || actionToast ? (
        <div className="pointer-events-none fixed right-6 top-24 z-50">
          <div className="rounded-2xl border border-cyan-300/30 bg-black/80 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-xl backdrop-blur">
            {saveToast ?? actionToast}
          </div>
        </div>
      ) : null}

      {deleteConfirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold tracking-tight">
              Delete Project
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Are you sure you want to delete this project? This will remove
              it from your device.
            </p>

            {actionError ? (
              <p className="mt-3 text-sm text-fuchsia-200/90" aria-live="polite">
                {actionError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isMutating}
                className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={isMutating}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renameId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold tracking-tight">
              Rename Project
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Choose a new title for your project.
            </p>

            <div className="mt-4">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40"
                aria-label="Rename project title"
                autoFocus
              />
            </div>

            {actionError ? (
              <p className="mt-3 text-sm text-fuchsia-200/90" aria-live="polite">
                {actionError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={saveRename}
                disabled={isMutating}
                className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={isMutating}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
     </>
   );
 }

