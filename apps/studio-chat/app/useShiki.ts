"use client";

import { useEffect, useState, useRef } from "react";

type Highlighter = {
  codeToHtml: (code: string, options: {
    lang: string;
    themes: Record<string, string>;
    defaultColor: string;
  }) => string;
};

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (highlighterPromise) return highlighterPromise;
  highlighterPromise = (async () => {
    const shiki = await import("shiki");
    const highlighter = await shiki.createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript", "typescript", "jsx", "tsx", "python", "rust",
        "go", "java", "kotlin", "swift", "ruby", "php", "c", "cpp",
        "csharp", "bash", "shell", "sql", "html", "css", "json",
        "yaml", "markdown", "diff", "dockerfile", "graphql",
      ],
    });
    return highlighter as unknown as Highlighter;
  })();
  return highlighterPromise;
}

export function useShiki() {
  const [ready, setReady] = useState(false);
  const highlighterRef = useRef<Highlighter | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    getHighlighter().then((h) => {
      highlighterRef.current = h;
      setReady(true);
    });
  }, []);

  function highlight(code: string, lang: string): string | null {
    if (!highlighterRef.current) return null;
    try {
      return highlighterRef.current.codeToHtml(code, {
        lang: lang || "text",
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
        defaultColor: "light-dark()",
      });
    } catch {
      return null;
    }
  }

  return { ready, highlight };
}
