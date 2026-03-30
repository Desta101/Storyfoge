"use client";

export type AnalyticsEventName =
  | "signup"
  | "login"
  | "create_page_viewed"
  | "create_story"
  | "characters_generated"
  | "comic_panels_generated"
  | "save_project"
  | "dashboard_viewed"
  | "project_opened"
  | "export"
  | "pricing_viewed"
  | "upgrade_clicked"
  | "premium_activated";

type AnalyticsPayload = {
  event: AnalyticsEventName;
  properties?: Record<string, string | number | boolean | null>;
};

function firstEventStorageKey(event: AnalyticsEventName) {
  return `storyforge.analytics.first.${event}`;
}

export function markFirstEvent(event: AnalyticsEventName): boolean {
  if (typeof window === "undefined") return true;
  try {
    const key = firstEventStorageKey(event);
    if (localStorage.getItem(key) === "1") return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export async function trackAnalyticsEvent(payload: AnalyticsPayload) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    // Analytics failures should never block user actions.
  }
}
