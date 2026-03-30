"use client";

import { useState } from "react";

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [liked, setLiked] = useState("");
  const [confusing, setConfusing] = useState("");
  const [nextFeature, setNextFeature] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked, confusing, nextFeature }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send feedback.");
      }

      setLiked("");
      setConfusing("");
      setNextFeature("");
      setSuccess("Thanks for your feedback!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0c0c12] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Send Feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-foreground/80 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground/85">
              What did you like?
            </span>
            <textarea
              value={liked}
              onChange={(e) => setLiked(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground/85">
              What was confusing?
            </span>
            <textarea
              value={confusing}
              onChange={(e) => setConfusing(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground/85">
              What feature do you want next?
            </span>
            <textarea
              value={nextFeature}
              onChange={(e) => setNextFeature(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-fuchsia-400/40"
            />
          </label>

          {error ? <p className="text-sm text-fuchsia-200/90">{error}</p> : null}
          {success ? <p className="text-sm text-cyan-200/90">{success}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Submit Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
