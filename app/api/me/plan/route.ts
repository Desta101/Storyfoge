import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ plan: "free" });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ plan: "free" });
  }

  const { data } = await supabase
    .from("user_billing")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = data?.plan === "premium" ? "premium" : "free";
  return NextResponse.json({ plan });
}
