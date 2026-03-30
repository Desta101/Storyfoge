export default function AuthOrDivider() {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label="Or continue with email">
      <div className="h-px flex-1 bg-white/10" />
      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.2em] text-foreground/40">
        or
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
