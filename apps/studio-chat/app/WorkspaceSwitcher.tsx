"use client";

export function WorkspaceSwitcher({
  onOpenPicker,
}: {
  onOpenPicker: () => void;
}) {
  return (
    <button
      onClick={onOpenPicker}
      className="inline-flex items-center gap-1.5 text-[12px] font-mono px-3 py-1.5 rounded-lg bg-deep border border-edge-soft hover:text-ink hover:border-edge hover:bg-elevated transition-all cursor-pointer"
      title="Open project bookmarks"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-ink-faint">Bookmarks</span>
    </button>
  );
}
