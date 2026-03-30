"use client";

import { useEffect } from "react";
import { applyThemeToDocument, loadPreferences } from "../lib/preferences";

/** Applies saved theme preference on app load (client-only). */
export default function ThemePreferenceSync() {
  useEffect(() => {
    const prefs = loadPreferences();
    applyThemeToDocument(prefs.theme);
  }, []);
  return null;
}
