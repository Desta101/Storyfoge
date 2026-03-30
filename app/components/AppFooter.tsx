"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import FeedbackModal from "./FeedbackModal";

export default function AppFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pathname = usePathname();
  const isAboutPage = pathname === "/about";

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4 sm:py-2.5 sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {!isAboutPage ? (
              <Link
                href="/about"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
              >
                About
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground/90 transition hover:bg-white/10"
            >
              Send Feedback
            </button>
          </div>
          <p className="shrink-0 text-right text-xs leading-none text-foreground/55 sm:text-sm">
            © 2026 StoryForge. All rights reserved.
          </p>
        </div>
      </footer>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
