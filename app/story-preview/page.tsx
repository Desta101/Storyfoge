import StoryPreviewClient from "./StoryPreviewClient";
import { Suspense } from "react";
import AppHeader from "../components/AppHeader";

export const metadata = {
  title: "Your Story Preview",
  description: "Preview your StoryForge story output.",
};

export default function StoryPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <AppHeader action={{ href: "/create", label: "Back" }} />
          <main className="mx-auto w-full max-w-6xl px-6 pb-16">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
              <div className="h-8 w-56 rounded bg-white/5" />
              <div className="mt-4 h-4 w-72 rounded bg-white/5" />
              <div className="mt-8 h-10 w-full rounded bg-white/5" />
            </section>
          </main>
        </div>
      }
    >
      <StoryPreviewClient />
    </Suspense>
  );
}

