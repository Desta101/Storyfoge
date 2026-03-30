"use client";

import { useEffect, useState } from "react";
import {
  loadPreferences,
  type DefaultExportFormat,
} from "../lib/preferences";

/**
 * Subscribes to Account settings → Preferences (default export format).
 * Updates when preferences are saved or changed in another tab (`storage` event).
 */
export function useDefaultExportFormat() {
  const [defaultExportFormat, setDefaultExportFormat] =
    useState<DefaultExportFormat>("png");

  useEffect(() => {
    function sync() {
      setDefaultExportFormat(loadPreferences().defaultExportFormat);
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("storyforge-preferences-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("storyforge-preferences-updated", sync);
    };
  }, []);

  return { defaultExportFormat };
}
