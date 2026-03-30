"use client";

import { useLayoutEffect } from "react";
import { resetFreePagesUsedForDev } from "../lib/plan";

/**
 * Resets free comic page usage in localStorage on each full load in dev/localhost.
 * See resetFreePagesUsedForDev() — production is unchanged.
 */
export default function DevFreeUsageReset() {
  useLayoutEffect(() => {
    resetFreePagesUsedForDev();
  }, []);

  return null;
}
