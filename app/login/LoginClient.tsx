"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { getSupabaseEnv } from "../lib/supabase/env";
import { resolvePostLoginRedirectPath } from "../lib/authReturn";
import { trackAnalyticsEvent } from "../lib/analytics";
import AuthOrDivider from "../components/auth/AuthOrDivider";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { hasSupabaseEnv } = getSupabaseEnv();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawUrlError = searchParams.get("error");
  const urlError =
    rawUrlError !== null
      ? (() => {
          try {
            return decodeURIComponent(rawUrlError);
          } catch {
            return rawUrlError;
          }
        })()
      : null;
  const combinedError = error ?? urlError;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured yet. Add env vars to continue.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      void trackAnalyticsEvent({
        event: "login",
        properties: { method: "email_password" },
      });
      router.push(resolvePostLoginRedirectPath(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
              <span className="text-sm font-bold tracking-tight">SF</span>
            </div>
            <div className="text-base font-semibold tracking-tight">StoryForge</div>
          </Link>
          <Link
            href={
              searchParams.get("next")
                ? `/signup?next=${encodeURIComponent(searchParams.get("next")!)}`
                : "/signup"
            }
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Log in</h1>
          <p className="mt-2 text-sm text-foreground/80 sm:text-base">
            Continue your StoryForge projects from your account.
          </p>

          {!hasSupabaseEnv ? (
            <p className="mt-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100/90">
              Missing `NEXT_PUBLIC_SUPABASE_URL` or
              `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
            </p>
          ) : null}

          <div className="mt-6 space-y-5">
            <GoogleSignInButton intent="login" />
            <AuthOrDivider />
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground/80">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground/80">
                  Password
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40"
                  placeholder="Your password"
                />
              </label>

              {combinedError ? (
                <p className="text-sm text-fuchsia-200/90" aria-live="polite">
                  {combinedError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Logging in..." : "Log in"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
