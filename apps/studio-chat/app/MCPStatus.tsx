"use client";

import { useEffect, useState, useRef } from "react";

export function MCPStatus() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (!cancelled) setHealthy(data.healthy === true);
      } catch {
        if (!cancelled) setHealthy(false);
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono tracking-wide uppercase"
      title={healthy === null ? "Checking server..." : healthy ? "Server connected" : "Server disconnected"}
    >
      <span
        className={`size-1.5 rounded-full ${
          healthy === null
            ? "bg-ink-faint/40 animate-pulse"
            : healthy
              ? "bg-emerald-500"
              : "bg-red-500"
        }`}
      />
      {healthy === null ? "checking..." : healthy ? "connected" : "disconnected"}
    </span>
  );
}
