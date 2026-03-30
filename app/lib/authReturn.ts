import type { StoryDraft } from "./storyDraft";
import { ensureDraftIntegrity, loadStoryDraftFromStorage, saveStoryDraftToStorage } from "./storyDraft";

const STORAGE_KEY = "storyforge.authReturn";
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

export type PendingAuthAction =
  | "generate_story"
  | "save_project"
  | "basic_export"
  | "hd_export"
  | "edit_page";

type StoredAuthReturn = {
  v: 1;
  returnPath: string;
  pendingAction: PendingAuthAction | null;
  draftSnapshot: StoryDraft | null;
  savedAt: number;
};

/** Safe in-app path only (open-redirect safe). */
export function sanitizeNextPath(input: string | null | undefined): string | null {
  if (input == null) return null;
  const p = input.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  if (p.includes("://") || p.includes("\\")) return null;
  return p.split("#")[0] ?? null;
}

function normalizePathname(p: string): string {
  const pathOnly = p.split("?")[0] ?? p;
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    return pathOnly.slice(0, -1);
  }
  return pathOnly || "/";
}

function readStored(): StoredAuthReturn | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1 || typeof o.returnPath !== "string" || typeof o.savedAt !== "number") {
      return null;
    }
    if (Date.now() - o.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const pendingAction =
      o.pendingAction === "generate_story" ||
      o.pendingAction === "save_project" ||
      o.pendingAction === "basic_export" ||
      o.pendingAction === "hd_export" ||
      o.pendingAction === "edit_page"
        ? o.pendingAction
        : null;
    let draftSnapshot: StoryDraft | null = null;
    if (o.draftSnapshot && typeof o.draftSnapshot === "object") {
      try {
        draftSnapshot = ensureDraftIntegrity(o.draftSnapshot as StoryDraft);
      } catch {
        draftSnapshot = null;
      }
    }
    return {
      v: 1,
      returnPath: o.returnPath,
      pendingAction,
      draftSnapshot,
      savedAt: o.savedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Persists return path, optional pending action, and a draft snapshot (for restore after OAuth / new tab edge cases).
 * Also writes the draft to normal story draft storage when provided.
 */
export function saveAuthReturnContext(opts: {
  returnPath: string;
  pendingAction: PendingAuthAction | null;
  draft?: StoryDraft | null;
}): void {
  if (typeof window === "undefined") return;
  const returnPath = sanitizeNextPath(opts.returnPath);
  if (!returnPath) return;

  let draftSnapshot: StoryDraft | null = null;
  if (opts.draft) {
    draftSnapshot = ensureDraftIntegrity(opts.draft);
    saveStoryDraftToStorage(draftSnapshot);
  } else {
    const existing = loadStoryDraftFromStorage();
    if (existing) {
      draftSnapshot = ensureDraftIntegrity(existing);
      saveStoryDraftToStorage(draftSnapshot);
    }
  }

  const payload: StoredAuthReturn = {
    v: 1,
    returnPath,
    pendingAction: opts.pendingAction,
    draftSnapshot,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

export function peekAuthReturnContext(): StoredAuthReturn | null {
  return readStored();
}

/** Path to use after email/password login (does not clear pending — destination page drains). */
export function resolvePostLoginRedirectPath(searchParamsNext: string | null): string {
  const stored = peekAuthReturnContext();
  const fromStored = stored ? sanitizeNextPath(stored.returnPath) : null;
  if (fromStored) return fromStored;
  const fromQuery = sanitizeNextPath(searchParamsNext);
  if (fromQuery) return fromQuery;
  return "/dashboard";
}

/**
 * Call on the page the user should return to. Clears storage when pathname matches.
 * Restores draft snapshot into story storage if present.
 */
export function drainAuthReturnContextAtDestination(currentPathname: string): PendingAuthAction | null {
  if (typeof window === "undefined") return null;
  const stored = readStored();
  if (!stored) return null;

  const want = normalizePathname(currentPathname);
  const target = normalizePathname(stored.returnPath);
  if (want !== target) return null;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  if (stored.draftSnapshot) {
    try {
      saveStoryDraftToStorage(ensureDraftIntegrity(stored.draftSnapshot));
    } catch {
      // ignore
    }
  }

  return stored.pendingAction;
}
