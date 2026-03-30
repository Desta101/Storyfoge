"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { fetchCurrentPlanTier, type PlanTier } from "../lib/plan";
import FeedbackModal from "./FeedbackModal";

type HeaderAction = {
  href: string;
  label: string;
};

type AppHeaderProps = {
  action?: HeaderAction;
  /** When true, hides the header "Send Feedback" control (e.g. home page uses footer feedback). */
  hideFeedback?: boolean;
  /** When set, shows a compact "Back" link first in the header action row (e.g. About page). */
  backHref?: string;
};

const supabase = createSupabaseBrowserClient();

export default function AppHeader({
  action,
  hideFeedback = true,
  backHref,
}: AppHeaderProps) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        if (!supabase) {
          if (mounted) setEmail(null);
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (mounted) {
          const userEmail = data.user?.email ?? null;
          setEmail(userEmail);
          if (userEmail) {
            const tier = await fetchCurrentPlanTier();
            setPlanTier(tier);
          } else {
            setPlanTier("free");
          }
        }
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    }

    void loadUser();

    const { data: subscription } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        setEmail(session?.user?.email ?? null);
        if (session?.user?.email) {
          void fetchCurrentPlanTier().then(setPlanTier);
        } else {
          setPlanTier("free");
        }
      }) ?? {};

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("[data-user-menu]")) setIsMenuOpen(false);
    };

    document.addEventListener("keydown", onEscape);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isMenuOpen]);

  const shortEmail = useMemo(() => {
    if (!email) return "";
    if (email.length <= 26) return email;
    return `${email.slice(0, 23)}...`;
  }, [email]);

  /** SF logo + StoryForge label: dashboard when signed in, home when signed out. */
  const brandHref = email ? "/dashboard" : "/";

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setIsMenuOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="w-full">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5">
        <Link href={brandHref} className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
            <span className="text-sm font-bold tracking-tight">SF</span>
          </div>
          <div className="text-base font-semibold tracking-tight">StoryForge</div>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
            >
              Back
            </Link>
          ) : null}

          {!hideFeedback ? (
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
            >
              Send Feedback
            </button>
          ) : null}

          {action ? (
            <Link
              href={action.href}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
            >
              {action.label}
            </Link>
          ) : null}

          {isLoadingAuth ? (
            <div className="h-10 w-28 animate-pulse rounded-full border border-white/10 bg-white/5" />
          ) : email ? (
            <div className="relative" data-user-menu>
              <button
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                title={email}
              >
                <span className="max-w-40 truncate">{shortEmail}</span>
                <span className="text-xs text-foreground/70">▾</span>
              </button>

              {planTier === "premium" ? (
                <span className="ml-2 inline-flex h-10 items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 text-xs font-semibold text-fuchsia-100">
                  Premium
                </span>
              ) : null}

              {isMenuOpen ? (
                <div className="absolute right-0 top-12 z-40 w-44 overflow-hidden rounded-2xl border border-white/10 bg-black/85 backdrop-blur">
                  <Link
                    href="/account-settings"
                    className="block px-4 py-3 text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Account settings
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-3 text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={isLoggingOut}
                    className="block w-full px-4 py-3 text-left text-sm font-semibold text-fuchsia-200/90 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 text-sm font-semibold text-black transition hover:brightness-110"
              >
                Signup
              </Link>
            </>
          )}
        </div>
      </div>
      {!hideFeedback ? (
        <FeedbackModal open={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      ) : null}
    </header>
  );
}
