"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { hasSupabaseEnv, supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!hasSupabaseEnv) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
