"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OnboardingClient() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
              <span className="text-sm font-bold tracking-tight">SF</span>
            </div>
            <div className="text-base font-semibold tracking-tight">StoryForge</div>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome to StoryForge
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80 sm:text-base">
            You&apos;re signed in with Google. Head to your dashboard to create and
            save projects, or start a new story from the home page.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
            >
              Go to dashboard
            </button>
            <Link
              href="/create"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
            >
              Start creating
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
