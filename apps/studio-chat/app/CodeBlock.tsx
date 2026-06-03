"use client";

import { useState, useEffect, useRef } from "react";
import { useShiki } from "./useShiki";

function CopyIcon({ copied }: { copied?: boolean }) {
  if (copied) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <path d="M4 12l5 5 11-11" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth={1.5} />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const { ready, highlight } = useShiki();
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!ready || pendingRef.current) return;
    pendingRef.current = true;
    const result = highlight(code, language || "text");
    if (result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHtml(result);
    }
  }, [ready, code, language, highlight]);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group my-3 rounded-xl overflow-hidden border border-edge shadow-sm">
      <div className="flex items-center justify-between bg-deep px-4 py-2 border-b border-edge">
        <span className="text-[11px] font-mono text-ink-faint uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] font-mono text-ink-faint hover:text-ink transition-colors"
        >
          <CopyIcon copied={copied} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {html ? (
        <div
          className="overflow-x-auto p-4 text-sm leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed bg-surface">
          <code className="font-mono">{code}</code>
        </pre>
      )}
    </div>
  );
}
