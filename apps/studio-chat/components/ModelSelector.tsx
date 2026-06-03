"use client";

import { useState, useEffect, useRef, useMemo, useCallback, forwardRef } from "react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  displayName: string;
}

interface ModelCategory {
  name: string;
  provider?: string;
  models: ModelEntry[];
}

interface FlatModel extends ModelEntry {
  categoryName: string;
  provider?: string;
}

export interface ModelSelectorProps {
  model: string;
  onModelChange: (m: string) => void;
  onClose: () => void;
}

// ─── Model Data ──────────────────────────────────────────────────────────

const CATEGORIES: ModelCategory[] = [
  {
    name: "Default",
    models: [{ id: "opencode/big-pickle", displayName: "Big Pickle" }],
  },
  {
    name: "Zen Models",
    provider: "Zen",
    models: [
      { id: "opencode/claude-sonnet-4", displayName: "Claude Sonnet 4" },
      { id: "opencode/claude-sonnet-4-5", displayName: "Claude Sonnet 4.5" },
      { id: "opencode/claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
      { id: "opencode/claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
      { id: "opencode/claude-opus-4-1", displayName: "Claude Opus 4.1" },
      { id: "opencode/claude-opus-4-5", displayName: "Claude Opus 4.5" },
      { id: "opencode/claude-opus-4-6", displayName: "Claude Opus 4.6" },
      { id: "opencode/claude-opus-4-7", displayName: "Claude Opus 4.7" },
      { id: "opencode/claude-opus-4-8", displayName: "Claude Opus 4.8" },
      { id: "opencode/deepseek-v4-flash", displayName: "DeepSeek V4 Flash" },
      { id: "opencode/deepseek-v4-flash-free", displayName: "DeepSeek V4 Flash Free" },
      { id: "opencode/gemini-3-flash", displayName: "Gemini 3 Flash" },
      { id: "opencode/gemini-3.1-pro", displayName: "Gemini 3.1 Pro" },
      { id: "opencode/gemini-3.5-flash", displayName: "Gemini 3.5 Flash" },
      { id: "opencode/glm-5", displayName: "GLM-5" },
      { id: "opencode/glm-5.1", displayName: "GLM-5.1" },
      { id: "opencode/gpt-5", displayName: "GPT-5" },
      { id: "opencode/gpt-5-codex", displayName: "GPT-5 Codex" },
      { id: "opencode/gpt-5-nano", displayName: "GPT-5 Nano" },
      { id: "opencode/gpt-5.1", displayName: "GPT-5.1" },
      { id: "opencode/gpt-5.1-codex", displayName: "GPT-5.1 Codex" },
      { id: "opencode/gpt-5.1-codex-max", displayName: "GPT-5.1 Codex Max" },
      { id: "opencode/gpt-5.1-codex-mini", displayName: "GPT-5.1 Codex Mini" },
      { id: "opencode/gpt-5.2", displayName: "GPT-5.2" },
      { id: "opencode/gpt-5.2-codex", displayName: "GPT-5.2 Codex" },
      { id: "opencode/gpt-5.3-codex", displayName: "GPT-5.3 Codex" },
      { id: "opencode/gpt-5.3-codex-spark", displayName: "GPT-5.3 Codex Spark" },
      { id: "opencode/gpt-5.4", displayName: "GPT-5.4" },
      { id: "opencode/gpt-5.4-mini", displayName: "GPT-5.4 Mini" },
      { id: "opencode/gpt-5.4-nano", displayName: "GPT-5.4 Nano" },
      { id: "opencode/gpt-5.4-pro", displayName: "GPT-5.4 Pro" },
      { id: "opencode/gpt-5.5", displayName: "GPT-5.5" },
      { id: "opencode/gpt-5.5-pro", displayName: "GPT-5.5 Pro" },
      { id: "opencode/grok-build-0.1", displayName: "Grok Build 0.1" },
      { id: "opencode/kimi-k2.5", displayName: "Kimi K2.5" },
      { id: "opencode/kimi-k2.6", displayName: "Kimi K2.6" },
      { id: "opencode/mimo-v2.5-free", displayName: "MiMo V2.5 Free" },
      { id: "opencode/minimax-m2.5", displayName: "MiniMax M2.5" },
      { id: "opencode/minimax-m2.7", displayName: "MiniMax M2.7" },
      { id: "opencode/minimax-m3-free", displayName: "MiniMax M3 Free" },
      { id: "opencode/nemotron-3-super-free", displayName: "Nemotron 3 Super Free" },
      { id: "opencode/qwen3.5-plus", displayName: "Qwen 3.5 Plus" },
      { id: "opencode/qwen3.6-plus", displayName: "Qwen 3.6 Plus" },
    ],
  },
  {
    name: "Go Models",
    provider: "Go",
    models: [
      { id: "opencode-go/deepseek-v4-flash", displayName: "DeepSeek V4 Flash" },
      { id: "opencode-go/deepseek-v4-pro", displayName: "DeepSeek V4 Pro" },
      { id: "opencode-go/glm-5", displayName: "GLM-5" },
      { id: "opencode-go/glm-5.1", displayName: "GLM-5.1" },
      { id: "opencode-go/kimi-k2.5", displayName: "Kimi K2.5" },
      { id: "opencode-go/kimi-k2.6", displayName: "Kimi K2.6" },
      { id: "opencode-go/mimo-v2.5", displayName: "MiMo V2.5" },
      { id: "opencode-go/mimo-v2.5-pro", displayName: "MiMo V2.5 Pro" },
      { id: "opencode-go/minimax-m2.5", displayName: "MiniMax M2.5" },
      { id: "opencode-go/minimax-m2.7", displayName: "MiniMax M2.7" },
      { id: "opencode-go/minimax-m3", displayName: "MiniMax M3" },
      { id: "opencode-go/qwen3.6-plus", displayName: "Qwen 3.6 Plus" },
      { id: "opencode-go/qwen3.7-max", displayName: "Qwen 3.7 Max" },
    ],
  },
];

// Flatten once — data is static
const ALL_MODELS: FlatModel[] = CATEGORIES.flatMap((c) =>
  c.models.map((m) => ({
    ...m,
    categoryName: c.name,
    provider: c.provider,
  })),
);

// Find display name for a model ID
function getDisplayName(modelId: string): string {
  const entry = ALL_MODELS.find((m) => m.id === modelId);
  return entry?.displayName ?? modelId.split("/").pop() ?? modelId;
}

// ─── Inline Icons ────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth={1.5} />
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth={1.5} />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────

export default function ModelSelector({ model, onModelChange, onClose }: ModelSelectorProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const currentDisplayName = getDisplayName(model);

  // ── Derived data ──

  const lowerQuery = query.toLowerCase().trim();
  const hasQuery = lowerQuery.length > 0;

  const visibleModels = useMemo(() => {
    if (hasQuery) {
      return ALL_MODELS.filter((m) => m.displayName.toLowerCase().includes(lowerQuery));
    }
    return ALL_MODELS.filter((m) => !collapsedCats.has(m.categoryName));
  }, [hasQuery, lowerQuery, collapsedCats]);

  // Clamp selectedIndex when list shrinks
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, visibleModels.length - 1)));
  }, [visibleModels.length]);

  // ── Auto-focus search on mount ──

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  // ── Keyboard navigation ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i < visibleModels.length - 1 ? i + 1 : i));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i > 0 ? i - 1 : i));
          break;
        case "Enter":
          e.preventDefault();
          if (visibleModels[selectedIndex]) {
            onModelChange(visibleModels[selectedIndex].id);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [visibleModels, selectedIndex, onModelChange, onClose],
  );

  // ── Scroll active item into view ──

  useEffect(() => {
    const btn = itemRefs.current.get(selectedIndex);
    btn?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ── Select model handler ──

  const handleSelect = useCallback(
    (id: string) => {
      onModelChange(id);
      onClose();
    },
    [onModelChange, onClose],
  );

  // ── Toggle category collapse ──

  const toggleCategory = useCallback((name: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Escape key listener (when input not focused) ──

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ── Build category-to-indices mapping for non-search rendering ──

  const categoryLayout = useMemo(() => {
    if (hasQuery) return null;
    const layout: { name: string; provider?: string; count: number; startIndex: number }[] = [];
    let idx = 0;
    for (const cat of CATEGORIES) {
      const isCollapsed = collapsedCats.has(cat.name);
      const count = cat.models.length;
      if (!isCollapsed) {
        layout.push({ name: cat.name, provider: cat.provider, count, startIndex: idx });
        idx += count;
      } else {
        layout.push({ name: cat.name, provider: cat.provider, count, startIndex: -1 });
      }
    }
    return layout;
  }, [hasQuery, collapsedCats]);

  // ── Render helpers ──

  const getItemRef = (index: number) => (el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(index, el);
    else itemRefs.current.delete(index);
  };

  // ── Render ──

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-2xl border border-edge bg-elevated shadow-2xl scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Select a model"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-ink tracking-tight">Select Model</h2>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/8 px-2.5 py-1 text-[11px] font-medium text-accent font-mono">
              <span className="size-1.5 rounded-full bg-accent" />
              {currentDisplayName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-deep transition-colors text-sm"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-5 pb-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Find a model..."
              className="w-full rounded-xl border border-edge bg-surface pl-10 pr-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-accent/40 focus:ring-2 focus:ring-glow placeholder:text-ink-faint"
              role="combobox"
              aria-expanded="true"
              aria-haspopup="listbox"
              aria-controls="model-listbox"
              aria-activedescendant={visibleModels[selectedIndex] ? `model-${selectedIndex}` : undefined}
            />
          </div>
        </div>

        {/* ── Results ── */}
        <div
          ref={listRef}
          id="model-listbox"
          role="listbox"
          aria-label="Available models"
          className="flex-1 overflow-y-auto px-3 pb-3 scroll-smooth"
          style={{ maxHeight: "55dvh" }}
        >
          {visibleModels.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[13px] text-ink-faint">No models found</p>
              <p className="text-[11px] text-ink-faint/60 mt-1">Try a different search term</p>
            </div>
          ) : hasQuery ? (
            /* ── Flat search results ── */
            <div className="space-y-0.5">
              {visibleModels.map((m, i) => (
                <ModelRow
                  key={m.id}
                  id={m.id}
                  displayName={m.displayName}
                  provider={m.provider}
                  isSelected={m.id === model}
                  isActive={i === selectedIndex}
                  ref={getItemRef(i)}
                  onSelect={handleSelect}
                  onHover={() => setSelectedIndex(i)}
                  index={i}
                />
              ))}
            </div>
          ) : (
            /* ── Categorized view ── */
            <div className="space-y-1">
              {categoryLayout?.map((cat) => {
                const isCollapsed = collapsedCats.has(cat.name);
                return (
                  <div key={cat.name}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(cat.name)}
                      className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-left group"
                    >
                      <ChevronIcon
                        className={cn(
                          "size-3.5 text-ink-faint transition-transform duration-200",
                          isCollapsed ? "" : "rotate-90",
                        )}
                      />
                      <span className="text-[13px] font-medium text-ink">{cat.name}</span>
                      <span className="text-[11px] font-mono text-ink-faint">{cat.count}</span>
                      {cat.provider && (
                        <span className="ml-auto inline-flex items-center text-[10px] font-mono text-ink-faint border border-edge rounded-md px-1.5 py-0.5">
                          {cat.provider}
                        </span>
                      )}
                    </button>

                    {/* Model items (hidden when collapsed) */}
                    {!isCollapsed && cat.startIndex >= 0 && (
                      <div className="ml-0 space-y-0.5">
                        {CATEGORIES.find((c) => c.name === cat.name)?.models.map((m, offset) => {
                          const globalIdx = cat.startIndex + offset;
                          return (
                            <ModelRow
                              key={m.id}
                              id={m.id}
                              displayName={m.displayName}
                              provider={cat.provider}
                              isSelected={m.id === model}
                              isActive={globalIdx === selectedIndex}
                              ref={getItemRef(globalIdx)}
                              onSelect={handleSelect}
                              onHover={() => setSelectedIndex(globalIdx)}
                              index={globalIdx}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Subtle footer count ── */}
          {visibleModels.length > 0 && (
            <div className="mt-3 px-2 pt-2 border-t border-edge/40 text-[10px] text-ink-faint/50 font-mono text-center">
              {hasQuery
                ? `${visibleModels.length} of ${ALL_MODELS.length} models`
                : `${visibleModels.length} models`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Model Row ───────────────────────────────────────────────────────────

const ModelRow = forwardRef<
  HTMLButtonElement,
  {
    id: string;
    displayName: string;
    provider?: string;
    isSelected: boolean;
    isActive: boolean;
    onSelect: (id: string) => void;
    onHover: () => void;
    index: number;
  }
>(({ id, displayName, provider, isSelected, isActive, onSelect, onHover, index }, ref) => {
  return (
    <button
      id={`model-${index}`}
      role="option"
      aria-selected={isSelected}
      ref={ref}
      onClick={() => onSelect(id)}
      onMouseEnter={onHover}
      className={cn(
        "group flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-left transition-all duration-150",
        isActive && !isSelected && "bg-surface",
        isSelected && "bg-accent/8",
      )}
    >
      {/* Checkmark / selection indicator */}
      <span className="flex items-center justify-center size-5 shrink-0">
        {isSelected ? (
          <CheckIcon className="size-5 text-accent" />
        ) : (
          <span className="size-1.5 rounded-full bg-edge group-hover:bg-ink-faint/40 transition-colors" />
        )}
      </span>

      {/* Model name */}
      <span
        className={cn(
          "flex-1 min-w-0 text-sm font-medium truncate",
          isSelected ? "text-accent" : "text-ink group-hover:text-ink",
        )}
      >
        {displayName}
      </span>

      {/* Provider badge */}
      {provider && (
        <span
          className={cn(
            "inline-flex items-center text-[10px] font-mono rounded-md px-2 py-0.5 border transition-colors shrink-0",
            isSelected
              ? "border-accent/20 bg-accent/10 text-accent"
              : "border-edge text-ink-faint group-hover:border-edge-soft group-hover:text-ink-dim",
          )}
        >
          {provider}
        </span>
      )}
    </button>
  );
});

ModelRow.displayName = "ModelRow";
