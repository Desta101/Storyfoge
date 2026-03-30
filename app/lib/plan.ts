export type PlanTier = "free" | "premium";

export const FREE_PLAN_MAX_SAVED_PROJECTS = 1;
export const FREE_PLAN_MAX_COMIC_PAGES = 3;
/** Character slots in the story editor (Premium unlocks more). */
export const FREE_PLAN_MAX_CHARACTERS = 3;
export const PREMIUM_PLAN_MAX_CHARACTERS = 10;

export const FREE_PAGES_USED_KEY = "storyforge.freePagesUsed";

/**
 * Clears the comic free-page counter on full page load when:
 * - running `next dev` (any hostname), or
 * - opening the app on localhost / loopback (including `next start` local QA).
 * Deployed production (non-localhost) is never reset.
 */
export function resetFreePagesUsedForDev() {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]";

  const isDev = process.env.NODE_ENV === "development";
  const isProdBuild = process.env.NODE_ENV === "production";

  if (isProdBuild && !isLocalHost) return;
  if (!isDev && !isLocalHost) return;

  try {
    localStorage.removeItem(FREE_PAGES_USED_KEY);
  } catch {
    // ignore
  }
}

export async function fetchCurrentPlanTier(): Promise<PlanTier> {
  if (typeof window === "undefined") return "free";
  try {
    const res = await fetch("/api/me/plan", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return "free";
    const data = (await res.json()) as { plan?: string };
    return data.plan === "premium" ? "premium" : "free";
  } catch {
    return "free";
  }
}

export function getFreePagesUsed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(FREE_PAGES_USED_KEY);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

export function incrementFreePagesUsed() {
  if (typeof window === "undefined") return;
  const current = getFreePagesUsed();
  try {
    localStorage.setItem(FREE_PAGES_USED_KEY, String(current + 1));
  } catch {
    // ignore
  }
}
