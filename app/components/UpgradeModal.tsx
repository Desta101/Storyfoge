"use client";

import { trackAnalyticsEvent } from "../lib/analytics";

import { UPGRADE_MODAL_DEFAULT_TITLE } from "../lib/upgradeCopy";

type UpgradeModalProps = {
  open: boolean;
  /** Modal heading; defaults to StoryForge premium title. */
  title?: string;
  reason: string;
  showReplaceAction?: boolean;
  onUpgrade: () => void;
  onMaybeLater: () => void;
  onReplaceExistingProject?: () => void;
};

export default function UpgradeModal({
  open,
  title = UPGRADE_MODAL_DEFAULT_TITLE,
  reason,
  showReplaceAction = false,
  onUpgrade,
  onMaybeLater,
  onReplaceExistingProject,
}: UpgradeModalProps) {
  if (!open) return null;

  function onTrackedUpgrade() {
    void trackAnalyticsEvent({
      event: "upgrade_clicked",
      properties: { source: "upgrade_modal" },
    });
    onUpgrade();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0c12] p-6 shadow-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
          {reason}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onTrackedUpgrade}
            className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={onMaybeLater}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
          >
            Maybe Later
          </button>
        </div>

        {showReplaceAction && onReplaceExistingProject ? (
          <button
            type="button"
            onClick={onReplaceExistingProject}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-6 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
          >
            Replace existing project
          </button>
        ) : null}
      </div>
    </div>
  );
}
