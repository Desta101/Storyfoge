import { Suspense } from "react";
import ComicPreviewClient from "./ComicPreviewClient";
import AppHeader from "../components/AppHeader";

export const metadata = {
  title: "Comic Page Preview",
  description: "Your first generated manga/comic page.",
};

export default function ComicPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <AppHeader action={{ href: "/character-preview", label: "Back" }} />

          <main className="mx-auto w-full max-w-6xl px-6 pb-16">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
              <div className="h-10 w-64 animate-pulse rounded bg-white/5" />
              <div className="mt-3 h-4 w-96 animate-pulse rounded bg-white/5" />
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`sk-${i}`}
                    className="h-[240px] animate-pulse rounded-3xl border border-white/10 bg-white/5"
                  />
                ))}
              </div>
              <div className="mt-10 h-12 w-full animate-pulse rounded-full bg-white/5" />
            </section>
          </main>
        </div>
      }
    >
      <ComicPreviewClient />
    </Suspense>
  );
}

