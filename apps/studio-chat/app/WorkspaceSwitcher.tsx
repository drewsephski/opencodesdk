"use client";

import { useState, useRef, useEffect } from "react";
import type { WorkspaceEntry } from "./useStudioChat";

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <path d="M2 7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WorkspaceSwitcher({
  activeWorkspace,
  isReconnecting,
  onOpenPicker,
}: {
  activeWorkspace: WorkspaceEntry | null;
  isReconnecting: boolean;
  onOpenPicker: () => void;
}) {
  if (isReconnecting) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint font-mono px-2.5 py-1 rounded-md bg-deep border border-edge-soft opacity-60 cursor-not-allowed"
      >
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
        Reconnecting…
      </button>
    );
  }

  if (!activeWorkspace) {
    return (
      <button
        onClick={onOpenPicker}
        className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint font-mono px-2.5 py-1.5 rounded-md bg-deep border border-edge-soft hover:text-ink hover:border-edge hover:bg-elevated transition-all cursor-pointer"
        title="Select a workspace"
      >
        <FolderIcon />
        <span>Select Workspace…</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpenPicker}
      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-md bg-deep border border-edge-soft hover:border-edge hover:bg-elevated transition-all cursor-pointer max-w-[240px]"
      title={`${activeWorkspace.name} — ${activeWorkspace.path}`}
    >
      <span className="size-1.5 rounded-full bg-accent shrink-0" />
      <span className="truncate text-ink font-medium">{activeWorkspace.name}</span>
      {activeWorkspace.framework && (
        <span className="text-[10px] text-ink-faint bg-surface px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
          {activeWorkspace.framework}
        </span>
      )}
    </button>
  );
}
