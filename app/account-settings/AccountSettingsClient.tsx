"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { getSupabaseEnv } from "../lib/supabase/env";
import {
  applyThemeToDocument,
  loadPreferences,
  savePreferences as persistPreferencesToStorage,
  type DefaultExportFormat,
  type ThemePreference,
  type UserPreferences,
} from "../lib/preferences";

export type TabId = "profile" | "preferences" | "billing" | "subscription";

const TAB_IDS: TabId[] = ["profile", "preferences", "billing", "subscription"];

const tabLabel: Record<TabId, string> = {
  profile: "Profile",
  preferences: "Preferences",
  billing: "Billing",
  subscription: "Subscription",
};

type BillingSummary = {
  plan: "free" | "premium";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  renewalDate: string | null;
  subscriptionStatus: string | null;
  billingUpdatedAt: string | null;
};

function fieldClass() {
  return "h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40";
}

function sectionTitle(text: string) {
  return (
    <h2 className="text-lg font-semibold tracking-tight text-foreground">{text}</h2>
  );
}

export default function AccountSettingsClient({
  initialTab,
}: {
  initialTab: TabId;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { hasSupabaseEnv } = getSupabaseEnv();

  const [tab, setTab] = useState<TabId>(initialTab);

  const setTabAndUrl = useCallback(
    (id: TabId) => {
      setTab(id);
      router.replace(`/account-settings?tab=${id}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // —— Profile ——
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const loadUser = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setEmail(user.email ?? "");
    setFullName(
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "",
    );
    setAvatarUrl(
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : "",
    );
  }, [supabase]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  async function saveProfile() {
    if (!supabase) return;
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      setProfileMessage("Profile saved.");
      router.refresh();
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changeEmail() {
    if (!supabase || !newEmail.trim()) return;
    setProfileError(null);
    setProfileMessage(null);
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) throw new Error(error.message);
      setProfileMessage(
        "Confirmation sent to your new email address. Complete the link to confirm the change.",
      );
      setNewEmail("");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not update email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword() {
    if (!supabase) return;
    if (newPassword.length < 6) {
      setProfileError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileError("Passwords do not match.");
      return;
    }
    setProfileError(null);
    setProfileMessage(null);
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(error.message);
      setProfileMessage("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  // —— Preferences ——
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  function updatePref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((p) => {
      if (!p) return p;
      const next = { ...p, [key]: value };
      if (key === "theme") {
        applyThemeToDocument(value as ThemePreference);
      }
      return next;
    });
    setPrefsSaved(false);
  }

  function handleSavePreferences() {
    if (!prefs) return;
    persistPreferencesToStorage(prefs);
    applyThemeToDocument(prefs.theme);
    setPrefsSaved(true);
  }

  // —— Billing / subscription data ——
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasSupabaseEnv) {
        setBillingLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/account/billing-summary", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) return;
          throw new Error("Could not load billing.");
        }
        const data = (await res.json()) as BillingSummary;
        if (!cancelled) setBilling(data);
      } catch {
        if (!cancelled) setBilling(null);
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hasSupabaseEnv]);

  async function openBillingPortal() {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Portal unavailable.");
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No portal URL.");
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : "Could not open portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  const renewalLabel = useMemo(() => {
    if (!billing?.renewalDate) return null;
    const d = new Date(billing.renewalDate);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [billing?.renewalDate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Account settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/75 sm:text-base">
            Manage your profile, preferences, and billing. Your projects stay on the
            dashboard.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-px">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTabAndUrl(id)}
              className={[
                "relative -mb-px inline-flex items-center border-b-2 px-4 py-3 text-sm font-semibold transition",
                tab === id
                  ? "border-fuchsia-500 text-foreground"
                  : "border-transparent text-foreground/55 hover:text-foreground/85",
              ].join(" ")}
            >
              {tabLabel[id]}
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          {tab === "profile" ? (
            <div className="space-y-10">
              {sectionTitle("Profile")}
              <p className="text-sm text-foreground/65">
                Update how you appear across StoryForge. Your email is also used for
                sign-in and billing receipts.
              </p>

              {!hasSupabaseEnv ? (
                <p className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100/90">
                  Supabase is not configured.
                </p>
              ) : null}

              <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  <p className="mb-2 text-sm font-medium text-foreground/80">Avatar</p>
                  <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    {avatarUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user-supplied URL
                      <img
                        src={avatarUrl.trim()}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-foreground/45">
                        No image
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground/80">
                      Profile image URL
                    </span>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className={fieldClass()}
                      placeholder="https://…"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground/80">
                      Full name
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={fieldClass()}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground/80">
                      Email
                    </span>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className={fieldClass() + " cursor-not-allowed opacity-80"}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={savingProfile || !supabase}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {savingProfile ? "Saving…" : "Save changes"}
                </button>
              </div>

              <div className="border-t border-white/10 pt-8">
                {sectionTitle("Change email")}
                <p className="mt-1 text-sm text-foreground/60">
                  We&apos;ll send a confirmation link to the new address.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="block min-w-0 flex-1">
                    <span className="mb-2 block text-sm font-medium text-foreground/80">
                      New email
                    </span>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={fieldClass()}
                      placeholder="new@example.com"
                      autoComplete="email"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void changeEmail()}
                    disabled={emailBusy || !newEmail.trim() || !supabase}
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {emailBusy ? "Sending…" : "Change email"}
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10 pt-8">
                {sectionTitle("Change password")}
                <p className="mt-1 text-sm text-foreground/60">
                  Signed in with Google? You can still set a password for email login.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground/80">
                      New password
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={fieldClass()}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground/80">
                      Confirm password
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={fieldClass()}
                      autoComplete="new-password"
                    />
                  </label>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void changePassword()}
                    disabled={passwordBusy || !supabase}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {passwordBusy ? "Updating…" : "Change password"}
                  </button>
                </div>
              </div>

              {profileError ? (
                <p className="text-sm text-fuchsia-200/90" aria-live="polite">
                  {profileError}
                </p>
              ) : null}
              {profileMessage ? (
                <p className="text-sm text-cyan-200/90" aria-live="polite">
                  {profileMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "preferences" && prefs ? (
            <div className="space-y-8">
              {sectionTitle("Preferences")}
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground/80">
                    Theme
                  </span>
                  <select
                    value={prefs.theme}
                    onChange={(e) =>
                      updatePref("theme", e.target.value as ThemePreference)
                    }
                    className={fieldClass()}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground/80">
                    Language
                  </span>
                  <select
                    value={prefs.language}
                    onChange={(e) => updatePref("language", e.target.value)}
                    className={fieldClass()}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground/80">
                    Default export format
                  </span>
                  <select
                    value={prefs.defaultExportFormat}
                    onChange={(e) =>
                      updatePref(
                        "defaultExportFormat",
                        e.target.value as DefaultExportFormat,
                      )
                    }
                    className={fieldClass()}
                  >
                    <option value="png">PNG (basic)</option>
                    <option value="png_hd">PNG (HD)</option>
                    <option value="pdf">PDF (story)</option>
                  </select>
                </label>
              </div>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={prefs.emailNotifications}
                    onChange={(e) =>
                      updatePref("emailNotifications", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black/30 text-fuchsia-500 focus:ring-fuchsia-400/50"
                  />
                  <span className="text-sm text-foreground/85">
                    Email notifications (project updates, tips)
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={prefs.productUpdates}
                    onChange={(e) => updatePref("productUpdates", e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/30 text-fuchsia-500 focus:ring-fuchsia-400/50"
                  />
                  <span className="text-sm text-foreground/85">
                    Product updates and changelog
                  </span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
                >
                  Save preferences
                </button>
                {prefsSaved ? (
                  <span className="text-sm text-cyan-200/90">Preferences saved.</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "billing" ? (
            <div className="space-y-8">
              {sectionTitle("Billing")}
              <p className="text-sm text-foreground/65">
                Payment methods, invoices, and billing history are managed securely
                through Stripe when you have an active Premium subscription.
              </p>

              {billingLoading ? (
                <p className="text-sm text-foreground/55">Loading…</p>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <h3 className="text-sm font-semibold text-foreground/90">
                      Payment method
                    </h3>
                    <p className="mt-1 text-sm text-foreground/60">
                      {billing?.stripeCustomerId
                        ? "Card and billing details are on file with Stripe."
                        : "No payment method on file. Upgrade to Premium to add one."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <h3 className="text-sm font-semibold text-foreground/90">
                      Invoices & billing history
                    </h3>
                    <p className="mt-1 text-sm text-foreground/60">
                      Download past invoices and receipts from your Stripe customer
                      portal.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void openBillingPortal()}
                      disabled={
                        portalLoading || !billing?.stripeCustomerId
                      }
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {portalLoading
                        ? "Opening…"
                        : "Open billing portal"}
                    </button>
                    {!billing?.stripeCustomerId ? (
                      <Link
                        href="/pricing"
                        className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
                      >
                        View plans
                      </Link>
                    ) : null}
                  </div>
                  {portalError ? (
                    <p className="text-sm text-fuchsia-200/90">{portalError}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === "subscription" ? (
            <div className="space-y-8">
              {sectionTitle("Subscription")}
              {billingLoading ? (
                <p className="text-sm text-foreground/55">Loading…</p>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/45">
                          Current plan
                        </p>
                        <p className="mt-1 text-2xl font-semibold capitalize">
                          {billing?.plan === "premium" ? "Premium" : "Free"}
                        </p>
                        <p className="mt-2 text-sm text-foreground/65">
                          Premium status:{" "}
                          <span className="font-medium text-foreground/90">
                            {billing?.plan === "premium" ? "Active" : "Not active"}
                          </span>
                        </p>
                      </div>
                      {billing?.plan === "premium" ? (
                        <span className="inline-flex items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-4 py-1.5 text-xs font-semibold text-fuchsia-100">
                          Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-foreground/70">
                          Free
                        </span>
                      )}
                    </div>
                    {renewalLabel && billing?.plan === "premium" ? (
                      <p className="mt-4 text-sm text-foreground/70">
                        <span className="text-foreground/50">Renews on </span>
                        {renewalLabel}
                        {billing.subscriptionStatus ? (
                          <span className="ml-2 text-xs text-foreground/45">
                            ({billing.subscriptionStatus})
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {billing?.plan === "free" ? (
                      <Link
                        href="/pricing"
                        className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(236,72,153,0.25)] transition hover:brightness-110"
                      >
                        Upgrade to Premium
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void openBillingPortal()}
                          disabled={portalLoading || !billing?.stripeCustomerId}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground/90 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          {portalLoading ? "Opening…" : "Manage subscription"}
                        </button>
                        <p className="w-full text-sm text-foreground/55">
                          Downgrade or cancel in the Stripe customer portal (takes
                          effect at the end of the billing period).
                        </p>
                      </>
                    )}
                  </div>
                  {portalError ? (
                    <p className="text-sm text-fuchsia-200/90">{portalError}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        <p className="mt-8 text-center text-sm text-foreground/45">
          <Link
            href="/dashboard"
            className="font-medium text-foreground/70 underline-offset-4 transition hover:text-foreground hover:underline"
          >
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
