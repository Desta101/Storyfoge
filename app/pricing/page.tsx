import AppHeader from "../components/AppHeader";
import PricingClient from "./PricingClient";

export const metadata = {
  title: "Pricing | StoryForge",
  description: "Compare StoryForge Free and Premium plans.",
};

/** Fresh render each request — reduces stale RSC vs client bundle mismatches in dev. */
export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[min(100%,92rem)] px-3 pb-14 sm:px-4 sm:pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgba(236,72,153,0.12),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-32 -z-10 h-56 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]"
        />

        <section className="pt-1 text-center sm:pt-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Pricing
          </h1>
          <p className="mx-auto mt-2 max-w-[34rem] text-pretty text-sm leading-relaxed text-foreground/75 sm:max-w-[36rem] sm:text-base">
            Choose the plan that fits your StoryForge workflow — start free or
            unlock the full creative studio.
          </p>

          <PricingClient />
        </section>
      </main>
    </div>
  );
}
