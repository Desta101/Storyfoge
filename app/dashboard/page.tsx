import DashboardClient from "./DashboardClient";
import { requireUser } from "../lib/auth";

export const metadata = {
  title: "My Projects",
  description: "View your saved StoryForge projects.",
};

export default async function DashboardPage() {
  await requireUser();
  return <DashboardClient />;
}

