"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { WorkspaceEntry } from "./useStudioChat";

/* ─── Icons ─── */

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={1.5} />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M2 7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 11H2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
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

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 16l1 2.5L21 19l-2 .5-.5 2L18 19l-2.5-1 2.5-1 .5-2z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Confirm Dialog ─── */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="rounded-2xl border border-edge bg-elevated shadow-2xl max-w-sm w-full p-6 scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink tracking-tight mb-2">{title}</h3>
        <p className="text-sm text-ink-dim leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium text-ink-dim hover:text-ink rounded-lg transition-colors">{cancelLabel}</button>
          <button onClick={onConfirm} className="px-4 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:brightness-110 transition-all">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── New Workspace Dialog ─── */

function NewWorkspaceDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, parentDir?: string, template?: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [template, setTemplate] = useState("empty");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setLocation("");
      setTemplate("empty");
      setError(null);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate(name.trim(), location.trim() || undefined, template);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  }, [name, location, template, onCreate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="rounded-2xl border border-edge bg-elevated shadow-2xl max-w-md w-full p-6 scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-8 rounded-lg bg-accent/10 text-accent">
              <SparkleIcon />
            </span>
            <h3 className="text-base font-semibold text-ink tracking-tight">New Workspace</h3>
          </div>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors text-sm">&#10005;</button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
            <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-ink-dim mb-1.5">Project name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="my-awesome-project"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent/40 focus:ring-2 focus:ring-glow placeholder:text-ink-faint transition-all"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-dim mb-1.5">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={`~/Desktop`}
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-[13px] font-mono outline-none focus:border-accent/40 focus:ring-2 focus:ring-glow placeholder:text-ink-faint transition-all"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-dim mb-2">Template</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTemplate("empty")}
                className={`px-4 py-3 rounded-xl text-left border transition-all ${
                  template === "empty"
                    ? "border-accent bg-accent/8 text-ink ring-1 ring-accent/20"
                    : "border-edge hover:border-edge-soft text-ink-dim hover:bg-surface"
                }`}
                disabled={loading}
              >
                <div className="text-[13px] font-medium">Empty</div>
                <div className="text-[10px] text-ink-faint mt-0.5">Just a blank folder</div>
              </button>
              <button
                onClick={() => setTemplate("node")}
                className={`px-4 py-3 rounded-xl text-left border transition-all ${
                  template === "node"
                    ? "border-accent bg-accent/8 text-ink ring-1 ring-accent/20"
                    : "border-edge hover:border-edge-soft text-ink-dim hover:bg-surface"
                }`}
                disabled={loading}
              >
                <div className="text-[13px] font-medium">Node.js</div>
                <div className="text-[10px] text-ink-faint mt-0.5">package.json + index.js</div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-edge">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-ink-dim hover:text-ink rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
            className="px-5 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Creating…
              </>
            ) : (
              "Create Workspace"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main WorkspacePicker ─── */

export function WorkspacePicker({
  open,
  onClose,
  workspaces,
  activeWorkspace,
  onSwitch,
  onAdd,
  onCreate,
  onRemove,
  hasMessages,
}: {
  open: boolean;
  onClose: () => void;
  workspaces: WorkspaceEntry[];
  activeWorkspace: WorkspaceEntry | null;
  onSwitch: (id: string) => Promise<void>;
  onAdd: (path: string) => Promise<WorkspaceEntry>;
  onCreate: (name: string, parentDir?: string, template?: string) => Promise<WorkspaceEntry & { dirPath: string; message: string }>;
  onRemove: (id: string) => Promise<void>;
  hasMessages: boolean;
}) {
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [addPath, setAddPath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !showNewDialog) {
      setTimeout(() => searchRef.current?.focus(), 100);
      setSearch("");
      setSwitchError(null);
      setAddPath("");
      setAddError(null);
    }
  }, [open, showNewDialog]);

  const handleAdd = useCallback(async () => {
    const path = addPath.trim();
    if (!path) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await onAdd(path);
      setAddPath("");
      setTimeout(() => searchRef.current?.focus(), 100);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add workspace");
    } finally {
      setIsAdding(false);
    }
  }, [addPath, onAdd]);

  const handleSwitch = useCallback(async (id: string) => {
    setIsSwitching(true);
    setSwitchError(null);
    try {
      await onSwitch(id);
      onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; options?: string[]; workspace?: { name: string; path: string } };
      if (err.options?.includes("remove") && err.workspace) {
        setSwitchError(`The directory for "${err.workspace.name}" no longer exists.\nYou can remove it or choose another path.`);
      } else {
        setSwitchError(err.error ?? "Failed to switch workspace. Is squid-chat CLI running?");
      }
    } finally {
      setIsSwitching(false);
    }
  }, [onSwitch, onClose]);

  const handleCreate = useCallback(async (name: string, parentDir?: string, template?: string) => {
    const result = await onCreate(name, parentDir, template);
    // Auto-switch to the new workspace
    await onSwitch(result.id);
    onClose();
  }, [onCreate, onSwitch, onClose]);

  const filtered = workspaces.filter(
    (w) => !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.path.toLowerCase().includes(search.toLowerCase()),
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-ink/10 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg rounded-2xl border border-edge bg-elevated shadow-2xl overflow-hidden scale-in max-h-[80dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-ink tracking-tight">Workspaces</h2>
            <span className="text-[10px] font-mono text-ink-faint bg-deep px-2 py-0.5 rounded-full">{workspaces.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-accent border border-accent/20 rounded-lg hover:bg-accent/10 transition-all"
            >
              <PlusIcon />
              New
            </button>
            <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors text-sm">&#10005;</button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"><SearchIcon /></span>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces by name or path…"
              className="w-full rounded-xl border border-edge bg-surface pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-accent/40 focus:ring-2 focus:ring-glow placeholder:text-ink-faint transition-all"
            />
          </div>
        </div>

        {/* Error state */}
        {switchError && (
          <div className="mx-4 mt-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
            <p className="text-[12px] text-red-600 dark:text-red-400 whitespace-pre-wrap">{switchError}</p>
          </div>
        )}

        {addError && (
          <div className="mx-4 mt-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
            <p className="text-[12px] text-red-600 dark:text-red-400">{addError}</p>
          </div>
        )}

        {/* Workspace list */}
        <div className="overflow-y-auto flex-1 px-2 py-2 min-h-0">
          {workspaces.length === 0 && !search ? (
            <div className="px-3 py-12 text-center">
              <div className="flex justify-center mb-4 text-ink-faint/60"><FolderOpenIcon /></div>
              <p className="text-[14px] font-medium text-ink-dim">No workspaces yet</p>
              <p className="text-[12px] text-ink-faint mt-1.5 max-w-xs mx-auto leading-relaxed">
                Create a new project or add an existing folder to get started.
              </p>
              <div className="flex items-center justify-center gap-2 mt-5">
                <button
                  onClick={() => setShowNewDialog(true)}
                  className="px-4 py-2 text-[12px] font-medium text-white bg-accent rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5"
                >
                  <PlusIcon />
                  New Project
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[13px] text-ink-dim">No matching workspaces</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((w) => {
                const isActive = w.id === activeWorkspace?.id;
                return (
                  <div
                    key={w.id}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActive
                        ? "bg-accent/5 border border-accent/15"
                        : "hover:bg-surface border border-transparent"
                    } ${isSwitching ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <div className={`size-2 rounded-full shrink-0 ${isActive ? "bg-accent" : "bg-edge-soft"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-ink truncate">{w.name}</span>
                        {isActive && (
                          <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded-full shrink-0">active</span>
                        )}
                        {w.framework && (
                          <span className="text-[10px] text-ink-faint bg-deep px-1.5 py-0.5 rounded-md truncate max-w-[90px] shrink-0">{w.framework}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-ink-faint font-mono truncate">{w.path}</span>
                        <span className="text-[10px] text-ink-faint/60 shrink-0">{new Date(w.lastOpened).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (hasMessages && !isActive) setConfirmTarget(w.id);
                          else if (!isActive) handleSwitch(w.id);
                        }}
                        disabled={isActive || isSwitching}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-accent border border-accent/20 rounded-lg hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title={isActive ? "Current workspace" : "Switch to this workspace"}
                      >
                        {isSwitching ? "…" : "Switch"}
                      </button>
                      <button
                        onClick={() => setRemoveTarget(w.id)}
                        className="opacity-0 group-hover:opacity-100 size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                        title="Remove workspace"
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

        {/* Add existing folder */}
        <div className="border-t border-edge px-4 py-3 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={addPath}
                onChange={(e) => { setAddPath(e.target.value); setAddError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="/path/to/existing/project"
                className="w-full rounded-lg border border-edge-soft bg-surface px-3 py-2 text-[12px] font-mono outline-none focus:border-accent/40 placeholder:text-ink-faint transition-all"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addPath.trim() || isAdding}
              className="shrink-0 px-3.5 py-2 text-[12px] font-medium text-white bg-accent rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isAdding ? "…" : "Add Folder"}
            </button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {removeTarget && (
        <ConfirmDialog
          title="Remove workspace?"
          message="This will remove the workspace from the list. The folder on disk will not be affected."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={async () => { const id = removeTarget; setRemoveTarget(null); await onRemove(id); }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Switch workspace?"
          message="This will end your current conversation. Your sessions for this workspace will be available when you switch back."
          confirmLabel="Switch"
          cancelLabel="Cancel"
          onConfirm={() => { const id = confirmTarget; setConfirmTarget(null); handleSwitch(id); }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      <NewWorkspaceDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
