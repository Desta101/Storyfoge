"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { fetchCurrentPlanTier, type PlanTier } from "../lib/plan";
import { markFirstEvent, trackAnalyticsEvent } from "../lib/analytics";

const PREMIUM_MONTHLY_DISPLAY =
  process.env.NEXT_PUBLIC_PREMIUM_MONTHLY_PRICE ?? "$9.99";

/** Shared rhythm — modern SaaS pricing density */
const T = {
  pad: "px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5",
  badgeRow: "flex min-h-8 shrink-0 items-center justify-between gap-2",
  badgeSlot: "flex min-h-8 min-w-0 flex-1 items-center",
  body: "mt-5 flex min-h-0 flex-1 flex-col sm:mt-6",
  planName: "text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/55",
  priceBlock: "mt-4 min-h-[3.25rem] sm:min-h-[3.5rem]",
  price: "text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]",
  priceMuted: "text-sm font-medium text-foreground/55",
  desc: "mt-3 text-[13px] leading-relaxed text-foreground/70 sm:text-sm",
  list: "mt-5 flex flex-col gap-3 text-left sm:gap-3.5",
  listPlus:
    "mt-4 border-t border-white/[0.08] pt-4 text-left sm:mt-5 sm:pt-5",
  plusLabel:
    "mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/45",
  ctaZone: "mt-auto w-full shrink-0 pt-6",
  ctaBtn:
    "inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold tracking-tight transition sm:py-3 sm:text-[0.9375rem]",
} as const;

const surfaceBase =
  "relative flex h-full min-h-[100%] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.035)] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.45)]";

const surfacePremium =
  "relative z-10 flex h-full min-h-[100%] flex-col overflow-hidden rounded-2xl border border-white/[0.14] bg-[rgba(255,255,255,0.04)] shadow-[0_8px_40px_-8px_rgba(0,0,0,0.55)]";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={className ?? "h-4 w-4 shrink-0 text-emerald-400/90"}
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.286a1 1 0 0 1-1.434-.002L3.29 9.015a1 1 0 1 1 1.42-1.406l3.341 3.372 6.59-6.59a1 1 0 0 1 1.414-.006Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FeatureRow({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <li
      className={[
        "flex gap-2.5 text-[13px] leading-snug sm:text-sm",
        accent ? "text-foreground/90" : "text-foreground/80",
      ].join(" ")}
    >
      <CheckIcon
        className={
          accent
            ? "mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400/85"
            : "mt-0.5 h-4 w-4 shrink-0 text-emerald-400/85"
        }
      />
      <span className={accent ? "font-medium" : undefined}>{children}</span>
    </li>
  );
}

function BadgeRow({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className={T.badgeRow}>
      <div className={`${T.badgeSlot} justify-start`}>{left}</div>
      <div className={`${T.badgeSlot} justify-end`}>{right}</div>
    </div>
  );
}

function PricingCardFrame({
  children,
  premium,
}: {
  children: ReactNode;
  premium?: boolean;
}) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
      {premium ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-fuchsia-500/10 via-transparent to-cyan-500/8 opacity-[0.72] blur-xl"
        />
      ) : null}
      {premium ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[1px] rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        />
      ) : null}
      <div className={premium ? surfacePremium : surfaceBase}>
        {!premium ? (
          <div className="pointer-events-none absolute -right-12 top-0 h-32 w-32 rounded-full bg-white/[0.03] blur-2xl" />
        ) : null}
        <div
          className={`relative z-10 flex h-full min-h-0 w-full flex-col ${T.pad}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PricingClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("free");

  useEffect(() => {
    void trackAnalyticsEvent({ event: "pricing_viewed" });
    void fetchCurrentPlanTier().then((tier) => {
      setPlanTier(tier);
      if (tier === "premium") {
        void trackAnalyticsEvent({
          event: "premium_activated",
          properties: {
            source: "pricing_page",
            first_time: markFirstEvent("premium_activated"),
          },
        });
      }
    });
  }, []);

  async function onUpgrade() {
    setIsLoading(true);
    setError(null);
    void trackAnalyticsEvent({
      event: "upgrade_clicked",
      properties: { source: "pricing_page" },
    });
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start checkout.");
      }

      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout.");
      setIsLoading(false);
    }
  }

  const premiumFeatures = (
    <>
      <FeatureRow accent>Unlimited saved projects</FeatureRow>
      <FeatureRow accent>Unlimited pages</FeatureRow>
      <FeatureRow accent>Full color</FeatureRow>
      <FeatureRow accent>HD export</FeatureRow>
      <FeatureRow accent>Edit all characters</FeatureRow>
    </>
  );

  return (
    <div className="mt-4 sm:mt-5">
      <div className="mx-auto grid w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-4 xl:gap-5">
        {/* Free — left */}
        <div className="flex h-full min-h-0 min-w-0 w-full">
          <PricingCardFrame>
            <BadgeRow
              left={
                planTier === "free" ? (
                  <span className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/75">
                    Current plan
                  </span>
                ) : null
              }
              right={null}
            />

            <div className={T.body}>
              <div className="shrink-0 text-center">
                <p className={T.planName}>Free</p>
                <div
                  className={`${T.priceBlock} flex items-baseline justify-center gap-1`}
                >
                  <span className={T.price}>$0</span>
                  <span className={T.priceMuted}>/ month</span>
                </div>
                <p className={T.desc}>
                  Start creating with core tools—perfect to try StoryForge.
                </p>
              </div>

              <ul className={`${T.list} min-h-0 flex-1`}>
                <FeatureRow>1 saved project</FeatureRow>
                <FeatureRow>Up to 3 comic pages</FeatureRow>
                <FeatureRow>Black &amp; white mode</FeatureRow>
                <FeatureRow>Basic export</FeatureRow>
                <FeatureRow>Edit 1 character</FeatureRow>
              </ul>

              <div className={T.ctaZone}>
                <Link
                  href="/create"
                  className={`${T.ctaBtn} border border-white/12 bg-white/[0.05] text-foreground/90 hover:bg-white/[0.08]`}
                >
                  Get started
                </Link>
              </div>
            </div>
          </PricingCardFrame>
        </div>

        {/* Premium — center */}
        <div className="flex h-full min-h-0 min-w-0 w-full">
          <PricingCardFrame premium>
            <BadgeRow
              left={
                <span className="inline-flex rounded-full border border-white/12 bg-white/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/90">
                  Most Popular
                </span>
              }
              right={
                planTier === "premium" ? (
                  <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-100/90">
                    Your plan
                  </span>
                ) : null
              }
            />

            <div className={T.body}>
              <div className="shrink-0 text-center">
                <p className={`${T.planName} text-foreground/70`}>Premium</p>
                <div
                  className={`${T.priceBlock} flex items-baseline justify-center gap-1`}
                >
                  <span className="bg-gradient-to-r from-neutral-100 to-neutral-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-[2rem]">
                    {PREMIUM_MONTHLY_DISPLAY}
                  </span>
                  <span className={T.priceMuted}>/ month</span>
                </div>
                <p className={`${T.desc} text-foreground/75`}>
                  Full creative control, color, and exports for serious creators.
                </p>
              </div>

              <ul className={`${T.list} min-h-0 flex-1`}>{premiumFeatures}</ul>

              <div className={T.ctaZone}>
                <button
                  type="button"
                  onClick={onUpgrade}
                  disabled={isLoading || planTier === "premium"}
                  className={`${T.ctaBtn} bg-gradient-to-r from-fuchsia-600/90 to-cyan-600/85 text-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)] transition-[transform,box-shadow,filter] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_rgba(0,0,0,0.55)] hover:brightness-[1.03] active:translate-y-0 active:brightness-[0.99] active:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)] disabled:hover:brightness-100`}
                >
                  {planTier === "premium"
                    ? "Current plan"
                    : isLoading
                      ? "Redirecting…"
                      : "Upgrade to Premium"}
                </button>
                {error ? (
                  <p
                    className="mt-2 text-center text-xs text-fuchsia-200/90"
                    aria-live="polite"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </PricingCardFrame>
        </div>

        {/* Creator Pro+ — right */}
        <div className="flex h-full min-h-0 min-w-0 w-full">
          <PricingCardFrame>
            <BadgeRow
              left={
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/75">
                  Future
                </span>
              }
              right={null}
            />

            <div className={T.body}>
              <div className="shrink-0 text-center">
                <p className={`${T.planName} text-foreground/70`}>
                  Creator Pro+
                </p>
                <div
                  className={`${T.priceBlock} flex items-baseline justify-center gap-1`}
                >
                  <span className="bg-gradient-to-r from-neutral-100 to-neutral-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-[2rem]">
                    Coming Soon
                  </span>
                </div>
                <p className={`${T.desc} text-foreground/75`}>
                  Advanced collaboration, AI generation, and cloud sync for
                  serious creators.
                </p>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ul className={`${T.list} min-h-0`}>{premiumFeatures}</ul>
                <div className={T.listPlus}>
                  <p className={T.plusLabel}>Plus — coming soon</p>
                  <ul className="flex flex-col gap-3 sm:gap-3.5">
                    <FeatureRow accent>Team collaboration</FeatureRow>
                    <FeatureRow accent>Shared projects</FeatureRow>
                    <FeatureRow accent>Advanced AI generation</FeatureRow>
                    <FeatureRow accent>Cloud sync</FeatureRow>
                    <FeatureRow accent>Early access tools</FeatureRow>
                  </ul>
                </div>
              </div>

              <div className={T.ctaZone}>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={`${T.ctaBtn} cursor-not-allowed border border-white/10 bg-white/[0.04] text-foreground/40`}
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </PricingCardFrame>
        </div>
      </div>
    </div>
  );
}
