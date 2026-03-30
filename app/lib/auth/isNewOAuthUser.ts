import type { User } from "@supabase/supabase-js";

/**
 * Treat OAuth users created within the last few minutes as "new" for redirect
 * (first Google sign-in). Returning users have an older `created_at`.
 */
export function isNewOAuthUser(user: User, maxAgeMs = 120_000): boolean {
  if (!user.created_at) return false;
  return Date.now() - new Date(user.created_at).getTime() < maxAgeMs;
}
