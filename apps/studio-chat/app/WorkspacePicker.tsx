"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { WorkspaceEntry } from "./useStudioChat";

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth={1.5} />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WorkspacePicker({
  open,
  onClose,
  workspaces,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  workspaces: WorkspaceEntry[];
  onAdd: (path: string) => Promise<WorkspaceEntry>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [addPath, setAddPath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<{ name: string; path: string } | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAddPath("");
      setAddError(null);
      setCopiedId(null);
      setJustAdded(null);
      setTimeout(() => addRef.current?.focus(), 100);
    }
  }, [open]);

  const handleAdd = useCallback(async () => {
    const path = addPath.trim();
    if (!path) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const entry = await onAdd(path);
      setAddPath("");
      setJustAdded({ name: entry.name, path: entry.path });
      // Auto-dismiss the success message after 8s
      setTimeout(() => setJustAdded(null), 8000);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add workspace");
    } finally {
      setIsAdding(false);
    }
  }, [addPath, onAdd]);

  const handleCopyCommand = useCallback(async (path: string, id?: string) => {
    const command = `cd "${path}" && npx squid-chat`;
    try {
      await navigator.clipboard.writeText(command);
      if (id) { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
    } catch {
      if (id) { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
    }
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/10 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg rounded-t-2xl border border-edge bg-elevated shadow-2xl overflow-hidden max-h-[80dvh] flex flex-col sm:top-16 sm:bottom-auto sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center size-9 rounded-xl bg-accent/10 text-accent">
              <BookmarkIcon />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink tracking-tight">Bookmarks</h2>
              <p className="text-[10px] text-ink-faint -mt-0.5">Saved project folders</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors">&#10005;</button>
        </div>

        {/* Add path input */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={addRef}
                value={addPath}
                onChange={(e) => { setAddPath(e.target.value); setAddError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="/path/to/project"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-[13px] font-mono outline-none focus:border-accent/40 focus:ring-2 focus:ring-glow placeholder:text-ink-faint transition-all"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addPath.trim() || isAdding}
              className="shrink-0 px-5 py-2.5 text-[13px] font-medium text-white bg-accent rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isAdding ? "Saving…" : "Add"}
            </button>
          </div>
          {addError && (
            <p className="text-[11px] text-red-500 mt-1.5 ml-1">{addError}</p>
          )}
        </div>

        {/* Just-added success banner */}
        {justAdded && (
          <div className="mx-4 mb-2 p-3.5 rounded-xl bg-accent/8 border border-accent/20 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink">{justAdded.name}</p>
                <p className="text-[10px] text-ink-faint font-mono truncate">{justAdded.path}</p>
              </div>
              <button onClick={() => setJustAdded(null)} className="size-5 flex items-center justify-center rounded text-ink-faint hover:text-ink shrink-0">&#10005;</button>
            </div>
            <div>
              <p className="text-[11px] text-ink-dim mb-1.5">Run this in your terminal to start chatting:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-deep border border-edge-soft px-3 py-2 text-[12px] font-mono text-ink select-all">
                  cd &quot;{justAdded.path}&quot; &amp;&amp; npx squid-chat
                </code>
                <button
                  onClick={() => handleCopyCommand(justAdded.path)}
                  className="shrink-0 size-8 flex items-center justify-center rounded-lg bg-accent text-white hover:brightness-110 transition-all"
                  title="Copy command"
                >
                  <CopyIcon />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace list */}
        <div className="overflow-y-auto flex-1 px-3 py-1 min-h-0">
          {workspaces.length === 0 && !justAdded ? (
            <div className="px-3 py-14 text-center">
              <div className="flex justify-center mb-4 text-ink-faint/30">
                <BookmarkIcon />
              </div>
              <p className="text-[13px] font-medium text-ink-dim">No bookmarks yet</p>
              <p className="text-[11px] text-ink-faint mt-1 max-w-xs mx-auto leading-relaxed">
                Paste a project path above and save it. Then copy the command to start chatting in that project.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 pb-2">
              {[...workspaces].reverse().map((w) => {
                const isCopied = copiedId === w.id;
                return (
                  <div
                    key={w.id}
                    className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface transition-all border border-transparent hover:border-edge"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink truncate">{w.name}</span>
                        {w.framework && (
                          <span className="text-[10px] text-ink-faint bg-deep px-1.5 py-0.5 rounded-md truncate max-w-[90px] shrink-0">{w.framework}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-ink-faint font-mono truncate">{w.path}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyCommand(w.path, w.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-accent bg-accent/10 rounded-lg hover:bg-accent/15 transition-all"
                      >
                        {isCopied ? (
                          <><CheckIcon /> Copied</>
                        ) : (
                          <><CopyIcon /> Copy command</>
                        )}
                      </button>
                      <button
                        onClick={() => onRemove(w.id)}
                        className="opacity-0 group-hover:opacity-100 size-8 flex items-center justify-center rounded-lg text-ink-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                        title="Remove bookmark"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-edge/60 px-4 py-2.5 shrink-0">
          <p className="text-[10px] text-ink-faint/50 text-center">
            Copy a command, paste it in your terminal, and <kbd className="font-mono text-[10px] bg-deep px-1 rounded">Enter</kbd> — you&apos;ll be chatting in that project.
          </p>
        </div>
      </div>
    </>
  );
}
