import { createSupabaseServerClient } from "./supabase/server";
import type { PlanTier } from "./plan";

/**
 * Server-only: current user's billing tier from Supabase (defaults to free).
 */
export async function getUserPlanTierFromServer(): Promise<PlanTier> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return "free";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data } = await supabase
    .from("user_billing")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.plan === "premium" ? "premium" : "free";
}
