"use client";

import { useRef, useEffect, useState, type FormEvent } from "react";
import { useStudioChat } from "./useStudioChat";
import { CodeBlock } from "./CodeBlock";
import { MCPStatus } from "./MCPStatus";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SquidChatMark } from "@/components/logo";

const SUGGESTIONS = [
  "What does this directory contain?",
  "What programming languages are used in this project?",
  "What are the main components of this project?",
  "Give me 5 tips for improving this codebase",
];

function PersonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle cx="12" cy="8" r="4.5" fill="currentColor" />
      <path
        d="M3.5 21c0-4.5 3.8-8 8.5-8s8.5 3.5 8.5 8"
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5 transition-transform duration-200 group-open:rotate-90">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThoughtIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <path d="M9.5 3A5.5 5.5 0 004 8.5c0 1.5.6 2.9 1.6 3.9L7 13.8V17h10v-3.2l1.4-1.4a5.5 5.5 0 10-2.3-9.6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot size-2 rounded-full bg-accent/70" />
      ))}
    </div>
  );
}

type InlinePart =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "inline-code"; content: string };

type Part =
  | InlinePart
  | { type: "code"; content: string; language?: string };

function processInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const segments = text.split(/(`[^`]+`)/g);
  for (const seg of segments) {
    if (seg.startsWith("`") && seg.endsWith("`")) {
      parts.push({ type: "inline-code", content: seg.slice(1, -1) });
    } else {
      const boldSegments = seg.split(/(\*\*[^*]+\*\*)/g);
      for (const bs of boldSegments) {
        if (bs.startsWith("**") && bs.endsWith("**")) {
          parts.push({ type: "bold", content: bs.slice(2, -2) });
        } else if (bs) {
          parts.push({ type: "text", content: bs });
        }
      }
    }
  }
  return parts;
}

function renderMarkdown(text: string): Part[] {
  const parts: Part[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/;
    const match = remaining.match(codeBlockRegex);
    if (!match) {
      parts.push(...processInline(remaining));
      break;
    }
    if (match.index! > 0) {
      parts.push(...processInline(remaining.slice(0, match.index)));
    }
    parts.push({ type: "code", content: match[2], language: match[1] || undefined });
    remaining = remaining.slice(match.index! + match[0].length);
  }
  return parts;
}

function renderInlinePart(part: InlinePart, key: number) {
  switch (part.type) {
    case "inline-code":
      return (
        <code key={key} className="rounded-md bg-deep border border-edge-soft px-1.5 py-0.5 text-[13px] font-mono text-ink-dim">
          {part.content}
        </code>
      );
    case "bold":
      return <strong key={key} className="font-semibold text-ink">{part.content}</strong>;
    default:
      return <span key={key}>{part.content}</span>;
  }
}

function MessageContent({ text }: { text: string }) {
  const parts = renderMarkdown(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "code") {
          return <CodeBlock key={i} code={part.content} language={part.language} />;
        }
        return renderInlinePart(part, i);
      })}
    </>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <details className="group my-6 rounded-xl border border-edge/60 bg-elevated/50 overflow-hidden open:pb-3 transition-all duration-200">
      <summary className="cursor-pointer flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-ink-faint hover:text-ink-dim transition-colors select-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-edge/30">
        <ChevronIcon />
        <ThoughtIcon />
        <span>Reasoning</span>
        <span className="ml-auto text-[10px] text-ink-faint/40 group-open:hidden">Click to expand</span>
      </summary>
      <div className="px-4 pt-3 whitespace-pre-wrap font-mono text-[12px] leading-[1.7] text-ink-dim/90">
        {text}
      </div>
    </details>
  );
}

function ToolCallCard({
  part,
  status: cardStatus,
}: {
  part: { toolName?: string; toolCallId?: string; input?: string; result?: string; isError?: boolean };
  status: "pending" | "running" | "completed" | "error";
}) {
  const [inputOpen, setInputOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const startTimeRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startTimeRef.current = performance.now();
    if (cardStatus === "running" || cardStatus === "pending") {
      const interval = setInterval(() => {
        setElapsed(performance.now() - startTimeRef.current);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setElapsed(performance.now() - startTimeRef.current);
    }
  }, [cardStatus]);

  const duration = elapsed > 0 ? `${(elapsed / 1000).toFixed(1)}s` : "";

  const colorMap = {
    pending: "border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
    running: "border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10",
    completed: "border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10",
    error: "border-l-red-400 bg-red-50/30 dark:bg-red-950/10",
  };

  const badgeColor = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className={`my-3 rounded-xl border border-edge overflow-hidden ${colorMap[cardStatus]} border-l-4`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[13px] font-medium text-ink">
            {part.toolName || "Tool"}
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${badgeColor[cardStatus]}`}>
            {cardStatus}
          </span>
        </div>
        <span className="text-[10px] font-mono text-ink-faint">{duration}</span>
      </div>
      {part.input && (
        <button
          onClick={() => setInputOpen(!inputOpen)}
          className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-mono text-ink-dim hover:text-ink border-t border-edge/50 transition-colors"
        >
          <ChevronIcon />
          Input
        </button>
      )}
      {inputOpen && part.input && (
        <pre className="px-4 py-2 text-[12px] font-mono text-ink-dim/90 bg-surface/50 border-t border-edge/30 overflow-x-auto max-h-48 overflow-y-auto">
          {part.input}
        </pre>
      )}
      {part.result !== undefined && (
        <button
          onClick={() => setOutputOpen(!outputOpen)}
          className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-mono text-ink-dim hover:text-ink border-t border-edge/50 transition-colors"
        >
          <ChevronIcon />
          {part.isError ? "Error" : "Output"}
        </button>
      )}
      {outputOpen && part.result !== undefined && (
        <pre className={`px-4 py-2 text-[12px] font-mono border-t border-edge/30 overflow-x-auto max-h-48 overflow-y-auto ${part.isError ? "text-red-500" : "text-ink-dim/90"}`}>
          {part.result}
        </pre>
      )}
    </div>
  );
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-edge bg-elevated shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink tracking-tight">Commands</h2>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors text-sm"
          >
            &#10005;
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface">
            <span className="flex items-center justify-center size-7 rounded-lg bg-deep text-xs font-mono text-ink-faint shrink-0">?</span>
            <div>
              <div className="text-sm font-medium text-ink">/help</div>
              <div className="text-xs text-ink-dim mt-0.5">Show available commands and usage information.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface">
            <span className="flex items-center justify-center size-7 rounded-lg bg-deep text-xs font-mono text-ink-faint shrink-0">⌫</span>
            <div>
              <div className="text-sm font-medium text-ink">/clear</div>
              <div className="text-xs text-ink-dim mt-0.5">Clear the current conversation and reset the active goal.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface">
            <span className="flex items-center justify-center size-7 rounded-lg bg-deep text-xs font-mono text-ink-faint shrink-0">◎</span>
            <div>
              <div className="text-sm font-medium text-ink">/goal &lt;objective&gt;</div>
              <div className="text-xs text-ink-dim mt-0.5">Set a goal or context that the AI will keep in mind throughout the conversation.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface">
            <span className="flex items-center justify-center size-7 rounded-lg bg-deep text-xs font-mono text-ink-faint shrink-0">⌘K</span>
            <div>
              <div className="text-sm font-medium text-ink">Cmd+K</div>
              <div className="text-xs text-ink-dim mt-0.5">Open the command palette for quick actions.</div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-ink-faint text-center">
          Press <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-deep border border-edge-soft text-[10px] font-mono">Escape</kbd> to close
        </p>
      </div>
    </div>
  );
}

function SessionSidebar({
  open,
  onClose,
  sessions,
  activeSessionId,
  onResume,
  onDelete,
  onNew,
}: {
  open: boolean;
  onClose: () => void;
  sessions: Array<{ id: string; title?: string; created?: string }>;
  activeSessionId: string | null;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = sessions.filter(
    (s) => !search || s.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-ink/10 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 left-0 z-40 h-dvh w-80 bg-elevated border-r border-edge shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="text-sm font-semibold text-ink">History</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onNew}
              className="px-3 py-1.5 text-[11px] font-medium text-accent border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors"
            >
              + New
            </button>
            <button
              onClick={onClose}
              className="size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors text-sm"
            >
              &#10005;
            </button>
          </div>
        </div>
        <div className="px-3 py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full rounded-lg border border-edge bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-accent/40 placeholder:text-ink-faint"
          />
        </div>
        <div className="overflow-y-auto h-[calc(100%-105px)]">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink-faint">
              {search ? "No matching sessions" : "No sessions yet"}
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-4 py-3 border-b border-edge/30 cursor-pointer transition-colors hover:bg-surface/50 ${
                  s.id === activeSessionId ? "bg-accent/5 border-l-2 border-l-accent" : ""
                }`}
                onClick={() => onResume(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">
                    {s.title || "Untitled Session"}
                  </div>
                  {s.created && (
                    <div className="text-[10px] text-ink-faint font-mono mt-0.5">
                      {new Date(s.created).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 size-6 flex items-center justify-center rounded text-ink-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all text-[11px]"
                  title="Delete session"
                >
                  &#10005;
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function FileAttachments({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      {files.map((f, i) => (
        <span
          key={`${f.name}-${i}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-deep border border-edge-soft text-[11px] font-mono text-ink-dim"
        >
          <PaperclipIcon />
          <span className="truncate max-w-[120px]">{f.name}</span>
          <button
            onClick={() => onRemove(i)}
            className="ml-0.5 text-ink-faint hover:text-ink transition-colors"
          >
            &#10005;
          </button>
        </span>
      ))}
    </div>
  );
}

function CommandPalette({
  onClose,
  actions,
}: {
  onClose: () => void;
  actions: Array<{ id: string; label: string; description: string; onSelect: () => void }>;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const filtered = actions.filter(
    (a) =>
      !query ||
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase()),
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].onSelect();
          onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-ink/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-edge bg-elevated shadow-2xl w-full max-w-lg overflow-hidden scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search actions..."
          className="w-full border-b border-edge bg-transparent px-5 py-4 text-sm outline-none placeholder:text-ink-faint"
        />
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-ink-faint">No results</div>
          ) : (
            filtered.map((a, i) => (
              <button
                key={a.id}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left text-sm transition-colors ${
                  i === selectedIndex ? "bg-accent/10 text-ink" : "text-ink-dim hover:bg-surface"
                }`}
                onClick={() => {
                  a.onSelect();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="min-w-0">
                  <div className="font-medium text-ink">{a.label}</div>
                  <div className="text-[11px] text-ink-faint">{a.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  onClose,
  model,
  onModelChange,
  systemPrompt,
  onSystemPromptChange,
  theme,
  onThemeChange,
}: {
  onClose: () => void;
  model: string;
  onModelChange: (m: string) => void;
  systemPrompt: string | null;
  onSystemPromptChange: (p: string | null) => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
}) {
  const [promptDraft, setPromptDraft] = useState(systemPrompt ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-edge bg-elevated shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-ink tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors text-sm"
          >
            &#10005;
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Model</label>
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Default</SelectLabel>
                  <SelectItem value="opencode/big-pickle">Big Pickle</SelectItem>
                </SelectGroup>

                <SelectSeparator />

                <SelectGroup>
                  <SelectLabel>Zen Models</SelectLabel>
                  <SelectItem value="opencode/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                  <SelectItem value="opencode/claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                  <SelectItem value="opencode/claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                  <SelectItem value="opencode/claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
                  <SelectItem value="opencode/claude-opus-4-1">Claude Opus 4.1</SelectItem>
                  <SelectItem value="opencode/claude-opus-4-5">Claude Opus 4.5</SelectItem>
                  <SelectItem value="opencode/claude-opus-4-6">Claude Opus 4.6</SelectItem>
                  <SelectItem value="opencode/claude-opus-4-7">Claude Opus 4.7</SelectItem>
                  <SelectItem value="opencode/claude-opus-4-8">Claude Opus 4.8</SelectItem>
                  <SelectItem value="opencode/deepseek-v4-flash">DeepSeek V4 Flash</SelectItem>
                  <SelectItem value="opencode/deepseek-v4-flash-free">DeepSeek V4 Flash Free</SelectItem>
                  <SelectItem value="opencode/gemini-3-flash">Gemini 3 Flash</SelectItem>
                  <SelectItem value="opencode/gemini-3.1-pro">Gemini 3.1 Pro</SelectItem>
                  <SelectItem value="opencode/gemini-3.5-flash">Gemini 3.5 Flash</SelectItem>
                  <SelectItem value="opencode/glm-5">GLM-5</SelectItem>
                  <SelectItem value="opencode/glm-5.1">GLM-5.1</SelectItem>
                  <SelectItem value="opencode/gpt-5">GPT-5</SelectItem>
                  <SelectItem value="opencode/gpt-5-codex">GPT-5 Codex</SelectItem>
                  <SelectItem value="opencode/gpt-5-nano">GPT-5 Nano</SelectItem>
                  <SelectItem value="opencode/gpt-5.1">GPT-5.1</SelectItem>
                  <SelectItem value="opencode/gpt-5.1-codex">GPT-5.1 Codex</SelectItem>
                  <SelectItem value="opencode/gpt-5.1-codex-max">GPT-5.1 Codex Max</SelectItem>
                  <SelectItem value="opencode/gpt-5.1-codex-mini">GPT-5.1 Codex Mini</SelectItem>
                  <SelectItem value="opencode/gpt-5.2">GPT-5.2</SelectItem>
                  <SelectItem value="opencode/gpt-5.2-codex">GPT-5.2 Codex</SelectItem>
                  <SelectItem value="opencode/gpt-5.3-codex">GPT-5.3 Codex</SelectItem>
                  <SelectItem value="opencode/gpt-5.3-codex-spark">GPT-5.3 Codex Spark</SelectItem>
                  <SelectItem value="opencode/gpt-5.4">GPT-5.4</SelectItem>
                  <SelectItem value="opencode/gpt-5.4-mini">GPT-5.4 Mini</SelectItem>
                  <SelectItem value="opencode/gpt-5.4-nano">GPT-5.4 Nano</SelectItem>
                  <SelectItem value="opencode/gpt-5.4-pro">GPT-5.4 Pro</SelectItem>
                  <SelectItem value="opencode/gpt-5.5">GPT-5.5</SelectItem>
                  <SelectItem value="opencode/gpt-5.5-pro">GPT-5.5 Pro</SelectItem>
                  <SelectItem value="opencode/grok-build-0.1">Grok Build 0.1</SelectItem>
                  <SelectItem value="opencode/kimi-k2.5">Kimi K2.5</SelectItem>
                  <SelectItem value="opencode/kimi-k2.6">Kimi K2.6</SelectItem>
                  <SelectItem value="opencode/mimo-v2.5-free">MiMo V2.5 Free</SelectItem>
                  <SelectItem value="opencode/minimax-m2.5">MiniMax M2.5</SelectItem>
                  <SelectItem value="opencode/minimax-m2.7">MiniMax M2.7</SelectItem>
                  <SelectItem value="opencode/minimax-m3-free">MiniMax M3 Free</SelectItem>
                  <SelectItem value="opencode/nemotron-3-super-free">Nemotron 3 Super Free</SelectItem>
                  <SelectItem value="opencode/qwen3.5-plus">Qwen 3.5 Plus</SelectItem>
                  <SelectItem value="opencode/qwen3.6-plus">Qwen 3.6 Plus</SelectItem>
                </SelectGroup>

                <SelectSeparator />

                <SelectGroup>
                  <SelectLabel>Go Models</SelectLabel>
                  <SelectItem value="opencode-go/deepseek-v4-flash">DeepSeek V4 Flash (Go)</SelectItem>
                  <SelectItem value="opencode-go/deepseek-v4-pro">DeepSeek V4 Pro (Go)</SelectItem>
                  <SelectItem value="opencode-go/glm-5">GLM-5 (Go)</SelectItem>
                  <SelectItem value="opencode-go/glm-5.1">GLM-5.1 (Go)</SelectItem>
                  <SelectItem value="opencode-go/kimi-k2.5">Kimi K2.5 (Go)</SelectItem>
                  <SelectItem value="opencode-go/kimi-k2.6">Kimi K2.6 (Go)</SelectItem>
                  <SelectItem value="opencode-go/mimo-v2.5">MiMo V2.5 (Go)</SelectItem>
                  <SelectItem value="opencode-go/mimo-v2.5-pro">MiMo V2.5 Pro (Go)</SelectItem>
                  <SelectItem value="opencode-go/minimax-m2.5">MiniMax M2.5 (Go)</SelectItem>
                  <SelectItem value="opencode-go/minimax-m2.7">MiniMax M2.7 (Go)</SelectItem>
                  <SelectItem value="opencode-go/minimax-m3">MiniMax M3 (Go)</SelectItem>
                  <SelectItem value="opencode-go/qwen3.6-plus">Qwen 3.6 Plus (Go)</SelectItem>
                  <SelectItem value="opencode-go/qwen3.7-max">Qwen 3.7 Max (Go)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">System Prompt</label>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              rows={6}
              placeholder="Default system prompt..."
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm font-mono outline-none focus:border-accent/40 placeholder:text-ink-faint resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setPromptDraft("");
                  onSystemPromptChange(null);
                }}
                className="px-3 py-1.5 text-[11px] font-medium text-ink-dim hover:text-ink transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => onSystemPromptChange(promptDraft || null)}
                className="px-3 py-1.5 text-[11px] font-medium text-white bg-accent rounded-lg hover:brightness-110 transition-all"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">Theme</label>
            <div className="flex gap-2">
              <button
                onClick={() => onThemeChange("light")}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  theme === "light"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-edge text-ink-dim hover:text-ink hover:border-edge-soft"
                }`}
              >
                Light
              </button>
              <button
                onClick={() => onThemeChange("dark")}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  theme === "dark"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-edge text-ink-dim hover:text-ink hover:border-edge-soft"
                }`}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    sessionId,
    sessionList,
    resumeSession,
    newSession,
    deleteSession,
    goal,
    setGoal,
    model,
    setModel,
    systemPrompt,
    setSystemPrompt,
    theme,
    setTheme,
    editMessage,
    regenerate,
  } = useStudioChat();

  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [streamTimedOut, setStreamTimedOut] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandMenuRef = useRef<HTMLDivElement>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressMenu = useRef(false);

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      streamTimeoutRef.current = setTimeout(() => {
        setStreamTimedOut(true);
      }, 30000);
    } else {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = null;
      }
    }
    return () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
    };
  }, [isStreaming]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowCommands(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showHelp) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowHelp(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showHelp]);

  useEffect(() => {
    if (!showCommandPalette) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showCommandPalette]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const COMMANDS = [
    { id: "help", label: "/help", description: "Show available commands and usage", icon: "?" },
    { id: "clear", label: "/clear", description: "Clear the conversation and goal", icon: "⌫" },
    { id: "goal", label: "/goal <objective>", description: "Set a goal for the AI to follow", icon: "◎" },
  ];

  const filteredCommands = COMMANDS.filter((c) =>
    c.id.startsWith(commandFilter.toLowerCase()),
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;
    if (showCommands && filteredCommands.length > 0) {
      const cmd = filteredCommands[selectedCommandIndex];
      if (cmd.id === "clear" || cmd.id === "help") {
        executeCommand(cmd);
      } else {
        insertCommandText(cmd);
      }
      return;
    }
    sendMessage(input);
    setInput("");
    attachedFiles.length = 0;
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function executeCommand(cmd: (typeof COMMANDS)[0]) {
    setShowCommands(false);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    switch (cmd.id) {
      case "clear":
        newSession();
        break;
      case "help":
        setShowHelp(true);
        break;
      case "goal": {
        const goalText = input.replace(/^\/goal\s*/i, "").trim();
        if (goalText) {
          setGoal(goalText);
          sendMessage(`Goal set: ${goalText}`);
        }
        break;
      }
    }
  }

  function insertCommandText(cmd: (typeof COMMANDS)[0]) {
    const text = cmd.id === "goal" ? "/goal " : cmd.label;
    setInput(text);
    setShowCommands(false);
    suppressMenu.current = true;
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function handleInputChange(value: string) {
    setInput(value);
    autoResize();
    if (suppressMenu.current) {
      suppressMenu.current = false;
      return;
    }
    if (value.startsWith("/")) {
      const afterSlash = value.slice(1);
      setCommandFilter(afterSlash);
      setShowCommands(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showCommands) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedCommandIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          return;
        case "ArrowUp":
          e.preventDefault();
          setSelectedCommandIndex((i) => Math.max(i - 1, 0));
          return;
        case "Escape":
          e.preventDefault();
          setShowCommands(false);
          return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const paletteActions = [
    { id: "clear", label: "Clear Conversation", description: "Reset the current chat and goal", onSelect: () => newSession() },
    { id: "new-session", label: "New Session", description: "Start a fresh conversation", onSelect: () => newSession() },
    { id: "toggle-theme", label: "Toggle Theme", description: `Switch to ${theme === "light" ? "dark" : "light"} mode`, onSelect: () => setTheme(theme === "light" ? "dark" : "light") },
    { id: "settings", label: "Open Settings", description: "Configure model, prompt, and theme", onSelect: () => setShowSettings(true) },
    { id: "help", label: "Help", description: "Show available commands", onSelect: () => setShowHelp(true) },
    { id: "history", label: "Session History", description: "Browse past conversations", onSelect: () => setShowSidebar(true) },
  ];

  function handleEditMessage(index: number) {
    const text = editMessage(index);
    if (text !== null) {
      setInput(text);
      textareaRef.current?.focus();
    }
  }

  function handleRegenerate(index: number) {
    regenerate(index);
  }

  function renderMessagePart(part: unknown, pi: number) {
    const p = part as { type: string; [key: string]: unknown };
    switch (p.type) {
      case "text":
        return <MessageContent key={pi} text={p.text as string} />;
      case "reasoning":
        return <ReasoningBlock key={pi} text={p.text as string} />;
      case "tool-call":
      case "tool-result": {
        const toolStatus =
          p.type === "tool-result"
            ? (p.isError as boolean)
              ? "error"
              : "completed"
            : "running";
        return (
          <ToolCallCard
            key={pi}
            part={p as { toolName?: string; toolCallId?: string; input?: string; result?: string; isError?: boolean }}
            status={toolStatus as "pending" | "running" | "completed" | "error"}
          />
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-dvh w-full bg-surface relative">
      <header className="border-b border-edge/60 bg-elevated/70 backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-12 rounded-xl bg-accent/10 text-accent animate-[pulse-glow_3s_ease-in-out_infinite]">
              <SquidChatMark size={32} />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight tracking-tight text-ink">
                squid-chat
              </h1>
            <div className="flex items-center gap-3 text-[10px] text-ink-faint font-mono tracking-wide uppercase">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-accent" />
                {model.split("/").pop() || "big-pickle"}
              </span>
              <MCPStatus />
              {isStreaming && (
                <span className="flex items-center gap-1 text-accent">
                  <span className="size-1 rounded-full bg-accent animate-pulse" />
                  generating
                </span>
              )}
              {streamTimedOut && !isStreaming && (
                <span className="flex items-center gap-1 text-red-500">
                  <span className="size-1 rounded-full bg-red-500" />
                  timeout
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {goal && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-ink-dim font-mono px-2.5 py-1 rounded-md bg-accent/8 border border-accent/15 max-w-[180px] truncate" title={goal}>
              <span>◎</span>
              <span className="truncate">{goal}</span>
            </span>
          )}
          <button
            onClick={() => setShowSidebar(true)}
            className="hidden sm:flex items-center gap-1.5 text-[11px] text-ink-faint font-mono px-2.5 py-1 rounded-md bg-deep border border-edge-soft hover:text-ink hover:border-edge transition-all"
            title="Session History"
          >
            <HistoryIcon />
            {sessionList.length > 0 && <span>{sessionList.length}</span>}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="hidden sm:flex items-center gap-1.5 text-[11px] text-ink-faint font-mono px-2.5 py-1 rounded-md bg-deep border border-edge-soft hover:text-ink hover:border-edge transition-all"
            title="Settings"
          >
            <SettingsIcon />
          </button>
          {messages.length > 0 && !isStreaming && (
            <span className="hidden sm:inline-flex items-center text-[11px] text-ink-faint font-mono px-2.5 py-1 rounded-md bg-deep border border-edge-soft">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 scroll-smooth">
        {error && (
          <div className="max-w-4xl mx-auto mt-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <span className="font-medium">Error</span>
              <span className="text-red-400 dark:text-red-500">{error.message}</span>
            </div>
          </div>
        )}

        {streamTimedOut && messages.length > 0 && (
          <div className="max-w-4xl mx-auto mt-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10">
            <div className="flex items-center justify-between text-sm text-amber-600 dark:text-amber-400">
              <span>Response is taking longer than expected...</span>
              <button
                onClick={() => setStreamTimedOut(false)}
                className="text-xs font-medium underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center min-h-full px-4 py-8">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center size-28 rounded-2xl bg-accent/8 mb-6 animate-[pulse-glow_4s_ease-in-out_infinite]">
                <SquidChatMark size={56} />
              </div>
              <h2 className="text-xl font-semibold text-ink tracking-tight text-balance">
                Start a conversation
              </h2>
              <p className="text-sm text-ink-dim mt-1.5 max-w-sm text-balance leading-relaxed">
                Ask anything — powered by the OpenCode SDK.
              </p>
              <p className="text-[11px] text-ink-faint mt-2 mb-8 font-mono">
                Type <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-deep border border-edge-soft text-[10px]">/</kbd> for commands
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="group relative px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border border-edge bg-elevated text-ink-dim hover:text-ink hover:border-accent/25 hover:bg-accent/[0.03] active:scale-[0.97] text-left leading-snug cursor-pointer"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <span className="relative z-0">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="py-6 space-y-5 max-w-4xl mx-auto">
              {messages.map((m, i) => (
                <div
                  key={m.id}
                  className={`message-enter flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  style={{ animationDelay: `${i * 0.02}s` }}
                >
                  {m.role === "assistant" && (
                    <div className="accent-line shrink-0 w-0.5 rounded-full bg-accent/30 mt-2 h-[calc(100%-8px)] self-stretch" />
                  )}
                  <div
                    className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
                      m.role === "user"
                        ? "bg-accent/10 text-accent"
                        : "bg-elevated border border-edge text-ink-dim"
                    }`}
                  >
                    {m.role === "user" ? <PersonIcon size={16} /> : <SquidChatMark size={24} />}
                  </div>
                  <div className={`min-w-0 max-w-[75%] ${m.role === "user" ? "" : "flex-1"}`}>
                    <div
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-ink text-[var(--bg-surface)] px-4 py-2.5 rounded-2xl rounded-tr-md"
                          : "text-ink"
                      }`}
                    >
                      {m.role === "user" ? (
                        <>
                          {(m.parts.find((p) => p.type === "text") as { text?: string } | undefined)?.text}
                        </>
                      ) : m.parts.length === 0 && isStreaming ? (
                        <TypingIndicator />
                      ) : (
                        m.parts.map((part, pi) => renderMessagePart(part, pi))
                      )}
                    </div>
                    {m.role === "user" && !isStreaming && (
                      <div className="flex items-center gap-1 mt-1.5 ml-1">
                        <button
                          onClick={() => handleEditMessage(i)}
                          className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-ink transition-colors px-1.5 py-0.5 rounded hover:bg-deep"
                          title="Edit message"
                        >
                          <EditIcon />
                        </button>
                      </div>
                    )}
                    {m.role === "assistant" && !isStreaming && messages[i - 1]?.role === "user" && (
                      <div className="flex items-center gap-1 mt-1.5 ml-1">
                        <button
                          onClick={() => handleRegenerate(i)}
                          className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-ink transition-colors px-1.5 py-0.5 rounded hover:bg-deep"
                          title="Regenerate"
                        >
                          <RefreshIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <footer className="border-t border-edge/60 bg-elevated/70 backdrop-blur-xl px-4 lg:px-6 py-3.5">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex items-center gap-1.5">
            <div className="flex-1 relative min-w-0">
              <FileAttachments
                files={attachedFiles}
                onAdd={(fileList) => setAttachedFiles((prev) => [...prev, ...Array.from(fileList)])}
                onRemove={(i) => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
              />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or / for commands..."
                disabled={isStreaming}
                rows={1}
                className="w-full resize-none rounded-xl border border-edge bg-surface px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-accent/40 focus:ring-2 focus:ring-glow disabled:opacity-40 placeholder:text-ink-faint leading-relaxed"
              />
              <kbd className="absolute right-3 bottom-3 hidden sm:inline-flex items-center text-[10px] text-ink-faint font-mono border border-edge rounded-md px-1.5 py-0.5 leading-none">
                &#8617;
              </kbd>
              {showCommands && filteredCommands.length > 0 && (
                <div
                  ref={commandMenuRef}
                  className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-edge bg-elevated shadow-lg overflow-hidden"
                >
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      type="button"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        i === selectedCommandIndex
                          ? "bg-accent/10 text-ink"
                          : "text-ink-dim hover:bg-surface"
                      }`}
                      onClick={() => {
                        if (cmd.id === "clear" || cmd.id === "help") {
                          executeCommand(cmd);
                        } else {
                          insertCommandText(cmd);
                        }
                      }}
                      onMouseEnter={() => setSelectedCommandIndex(i)}
                    >
                      <span className="flex items-center justify-center size-7 rounded-lg bg-deep text-xs font-mono text-ink-faint">
                        {cmd.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-ink">{cmd.label}</div>
                        <div className="text-[11px] text-ink-faint">{cmd.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.onchange = () => {
                    if (input.files?.length) setAttachedFiles((prev) => [...prev, ...Array.from(input.files!)]);
                  };
                  input.click();
                }}
                className="size-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink hover:bg-deep border border-transparent hover:border-edge transition-all"
                disabled={isStreaming}
                title="Attach files"
              >
                <PaperclipIcon />
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="size-8 rounded-lg flex items-center justify-center bg-accent/10 text-accent hover:bg-accent/20 active:bg-accent/30 transition-all"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && attachedFiles.length === 0}
                  className="h-9 rounded-lg flex items-center gap-1.5 bg-accent text-white hover:brightness-110 active:brightness-90 transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed px-3"
                >
                  <SendIcon />
                  <span className="text-[13px] font-medium leading-none">Send</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </footer>

      <SessionSidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        sessions={sessionList}
        activeSessionId={sessionId}
        onResume={(id) => {
          resumeSession(id);
          setShowSidebar(false);
        }}
        onDelete={deleteSession}
        onNew={() => {
          newSession();
          setShowSidebar(false);
        }}
      />

      {showCommandPalette && (
        <CommandPalette
          key="palette"
          onClose={() => setShowCommandPalette(false)}
          actions={paletteActions}
        />
      )}

      {showSettings && (
        <SettingsPanel
          key="settings"
          onClose={() => setShowSettings(false)}
          model={model}
          onModelChange={setModel}
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
