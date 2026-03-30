import AppHeader from "../components/AppHeader";

export const metadata = {
  title: "About | StoryForge",
  description:
    "Learn about StoryForge: mission, purpose, and how we help you turn ideas into manga and comics.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader backHref="/" />

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,rgba(236,72,153,0.14),transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-24 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_50%)]"
        />

        {/* Hero */}
        <section className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-8 sm:p-12 lg:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-cyan-500/12 blur-3xl" />

          <div className="relative flex flex-col items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:h-24 sm:w-24 sm:rounded-3xl">
              <span className="text-2xl font-bold tracking-tight sm:text-3xl">SF</span>
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-200/90">
              StoryForge
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn ideas into manga &amp; comics
            </h1>
            <p className="mt-4 max-w-xl text-base text-foreground/75 sm:text-lg">
              A guided path from spark to first page—without needing to be an artist.
            </p>
          </div>
        </section>

        {/* About — glow + glass card */}
        <section className="relative mt-6 sm:mt-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-4 -inset-y-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(236,72,153,0.16),transparent_65%)] sm:-inset-x-8"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-48 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/10 blur-[64px]"
          />

          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:rounded-3xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent" />
            <div className="relative px-6 py-8 sm:px-9 sm:py-10">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
                About StoryForge
              </h2>

              <div className="mt-7 space-y-5 text-base leading-relaxed text-foreground/82 sm:mt-8 sm:text-[17px] sm:leading-[1.75]">
                <p>
                  StoryForge was created from a real passion for storytelling, creativity, and
                  building something meaningful with AI.
                </p>
                <p>
                  The goal was to help anyone transform an idea into a visual comic or manga story,
                  even without artistic skills.
                </p>
                <p>
                  This product was built from the heart to give creators a fast and inspiring way to
                  bring stories to life.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Creator — premium card + glow */}
        <section className="relative mt-10 sm:mt-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-4 -inset-y-8 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_75%_55%_at_50%_45%,rgba(34,211,238,0.12),transparent_68%)] sm:-inset-x-8"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 -z-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-[56px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 -z-10 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-[48px]"
          />

          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-white/[0.02] p-8 shadow-[0_28px_90px_-16px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-md sm:rounded-3xl sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/12 blur-3xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/85">
                Creator
              </p>
              <p className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Created by Shimon Desta
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-foreground/65">
                Built StoryForge to make visual storytelling accessible—ideas first, tools that
                feel inspiring, not intimidating.
              </p>

              <a
                href="https://www.linkedin.com/in/shimon-desta-878043211/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center justify-center rounded-full border border-fuchsia-400/25 bg-fuchsia-500/[0.08] px-7 py-3 text-sm font-semibold text-fuchsia-100/95 shadow-[0_0_28px_-8px_rgba(217,70,239,0.45)] transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/[0.12]"
              >
                Connect on LinkedIn
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
