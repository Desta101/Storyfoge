export const PREFERENCES_STORAGE_KEY = "storyforge.settings.v1";

export type ThemePreference = "dark" | "light" | "system";

export type DefaultExportFormat = "png" | "pdf" | "png_hd";

export type UserPreferences = {
  theme: ThemePreference;
  emailNotifications: boolean;
  productUpdates: boolean;
  language: string;
  defaultExportFormat: DefaultExportFormat;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  emailNotifications: true,
  productUpdates: true,
  language: "en",
  defaultExportFormat: "png",
};

export function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      theme: parsed.theme ?? DEFAULT_PREFERENCES.theme,
      language: parsed.language ?? DEFAULT_PREFERENCES.language,
      defaultExportFormat:
        parsed.defaultExportFormat ?? DEFAULT_PREFERENCES.defaultExportFormat,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("storyforge-preferences-updated"));
  } catch {
    // ignore
  }
}

/** Read the saved default export format (SSR-safe: returns default when no window). */
export function getDefaultExportFormat(): DefaultExportFormat {
  return loadPreferences().defaultExportFormat;
}

export function defaultExportFormatLabel(
  format: DefaultExportFormat,
): string {
  switch (format) {
    case "png":
      return "PNG (basic)";
    case "png_hd":
      return "PNG (HD)";
    case "pdf":
      return "PDF (full story)";
    default:
      return "PNG (basic)";
  }
}

export function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light",
    );
    return;
  }
  if (theme === "dark") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.setAttribute("data-theme", "light");
}
