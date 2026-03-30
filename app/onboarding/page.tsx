import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/auth";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Welcome | StoryForge",
  description: "Get started with StoryForge.",
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <OnboardingClient />;
}
