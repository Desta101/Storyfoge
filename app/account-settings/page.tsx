import type { Metadata } from "next";
import { requireUser } from "../lib/auth";
import AccountSettingsClient, {
  type TabId,
} from "./AccountSettingsClient";

export const metadata: Metadata = {
  title: "Account settings | StoryForge",
  description: "Manage your StoryForge account, preferences, and billing.",
};

const VALID_TABS: TabId[] = ["profile", "preferences", "billing", "subscription"];

function parseTab(raw: string | undefined): TabId {
  if (raw && VALID_TABS.includes(raw as TabId)) {
    return raw as TabId;
  }
  return "profile";
}

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const initialTab = parseTab(sp.tab);

  return <AccountSettingsClient initialTab={initialTab} />;
}
