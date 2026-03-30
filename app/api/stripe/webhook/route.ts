import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getStripeClient } from "../../../lib/stripe";

function readPlanFromSubscriptionStatus(
  status: Stripe.Subscription.Status | undefined,
) {
  if (!status) return "free";
  if (status === "active" || status === "trialing") return "premium";
  return "free";
}

export async function POST(req: Request) {
  const stripe = getStripeClient();
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseAdmin = createSupabaseAdminClient();

  if (!stripe || !signingSecret || !supabaseAdmin) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, signingSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (userId) {
        await supabaseAdmin.from("user_billing").upsert(
          {
            user_id: userId,
            plan: "premium",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        console.info("[analytics]", {
          event: "premium_activated",
          user_id: userId,
          properties: { source: "stripe_webhook_checkout_completed" },
          at: new Date().toISOString(),
        });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        const nextPlan = readPlanFromSubscriptionStatus(subscription.status);
        await supabaseAdmin
          .from("user_billing")
          .update({
            plan: nextPlan,
            stripe_subscription_id: subscription.id,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
        if (nextPlan === "premium") {
          console.info("[analytics]", {
            event: "premium_activated",
            user_id: null,
            properties: { source: "stripe_webhook_subscription_updated", customer_id: customerId },
            at: new Date().toISOString(),
          });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await supabaseAdmin
          .from("user_billing")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
      }
    }
  } catch {
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
