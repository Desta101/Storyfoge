import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import { getStripeClient } from "@/app/lib/stripe";

export async function POST() {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
  }

  const { data } = await supabase
    .from("user_billing")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = data?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No billing profile yet. Subscribe to Premium to manage payment methods and invoices.",
      },
      { status: 400 },
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account-settings?tab=billing`,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create billing portal session." },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Billing portal is unavailable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
