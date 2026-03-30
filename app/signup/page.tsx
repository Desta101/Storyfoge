import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "../lib/authReturn";
import { getCurrentUser } from "../lib/auth";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  title: "Sign Up | StoryForge",
  description: "Create your StoryForge account.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const sp = await searchParams;
    redirect(sanitizeNextPath(sp.next ?? null) ?? "/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-xl px-6 py-24 text-center text-sm text-foreground/60">
            Loading…
          </div>
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
