"use client";

import {
  AUTH_REQUIRED_MODAL_MESSAGE,
  AUTH_REQUIRED_MODAL_TITLE,
} from "../lib/upgradeCopy";

type AuthRequiredModalProps = {
  open: boolean;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onMaybeLater: () => void;
};

export default function AuthRequiredModal({
  open,
  onSignIn,
  onCreateAccount,
  onMaybeLater,
}: AuthRequiredModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0c12] p-6 shadow-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {AUTH_REQUIRED_MODAL_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">
          {AUTH_REQUIRED_MODAL_MESSAGE}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onCreateAccount}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-foreground/90 transition hover:bg-white/10"
          >
            Create account
          </button>
        </div>

        <button
          type="button"
          onClick={onMaybeLater}
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-transparent px-6 text-sm font-medium text-foreground/70 transition hover:bg-white/[0.04] hover:text-foreground/90"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
