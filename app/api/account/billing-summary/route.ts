import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import { getStripeClient } from "@/app/lib/stripe";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      plan: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      renewalDate: null,
      subscriptionStatus: null,
      billingUpdatedAt: null,
    });
  }

  const { data } = await supabase
    .from("user_billing")
    .select("plan, stripe_customer_id, stripe_subscription_id, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = data?.plan === "premium" ? "premium" : "free";
  let renewalDate: string | null = null;
  let subscriptionStatus: string | null = null;

  const stripe = getStripeClient();
  if (stripe && data?.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        data.stripe_subscription_id,
        { expand: ["items.data"] },
      );
      const periodEnd = sub.items.data[0]?.current_period_end;
      if (periodEnd) {
        renewalDate = new Date(periodEnd * 1000).toISOString();
      }
      subscriptionStatus = sub.status;
    } catch {
      // Subscription missing in Stripe or API error
    }
  }

  return NextResponse.json({
    plan,
    stripeCustomerId: data?.stripe_customer_id ?? null,
    stripeSubscriptionId: data?.stripe_subscription_id ?? null,
    renewalDate,
    subscriptionStatus,
    billingUpdatedAt: data?.updated_at ?? null,
  });
}
