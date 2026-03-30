import Link from "next/link";
import AppHeader from "./components/AppHeader";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10 lg:p-12">
          {/* Decorative gradient glow */}
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          </div>

          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground/80">
                AI-powered manga & comics
              </p>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Turn your ideas into Manga &amp; Comics with AI
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
                From story beats to panel-ready scenes, StoryForge helps you
                generate manga-style moments and comic pages in minutes.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/create"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
                  aria-label="Start creating with StoryForge"
                >
                  Start Creating
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M11.5 4.5L16 9l-4.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 9h12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>

                <div className="text-sm text-foreground/70">
                  No prompt engineering required.
                </div>
              </div>
            </div>

            <div className="lg:justify-self-end">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between px-2 py-1">
                  <div className="text-xs font-medium text-foreground/70">
                    Preview
                  </div>
                  <div className="text-xs font-medium text-fuchsia-300">
                    Panel draft
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/25 to-cyan-500/10">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="h-2 w-5/6 rounded bg-white/20" />
                      <div className="mt-2 h-2 w-2/3 rounded bg-white/15" />
                    </div>
                  </div>

                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/10">
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-fuchsia-500/20 blur-xl" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="h-2 w-3/4 rounded bg-white/20" />
                      <div className="mt-2 h-2 w-1/2 rounded bg-white/15" />
                    </div>
                  </div>

                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-cyan-500/10">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="h-2 w-2/3 rounded bg-white/20" />
                      <div className="mt-2 h-2 w-4/6 rounded bg-white/15" />
                    </div>
                  </div>

                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/15 to-white/10">
                    <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-cyan-500/20 blur-xl" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="h-2 w-1/2 rounded bg-white/20" />
                      <div className="mt-2 h-2 w-2/3 rounded bg-white/15" />
                    </div>
                  </div>
                </div>

                <div
                  id="create"
                  className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-sm font-semibold text-foreground">
                    Ready to forge your next story?
                  </div>
                  <div className="mt-1 text-sm text-foreground/75">
                    Signup coming soon. For now, click the CTA to stay in
                    the loop.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
