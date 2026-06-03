"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SessionSummary {
  id: string;
  title?: string;
  created?: string;
  messageCount?: number;
}

export interface WorkspaceEntry {
  id: string;
  path: string;
  name: string;
  projectName?: string;
  framework?: string;
  language?: string;
  lastOpened: number;
  createdAt: number;
}

const STORAGE_KEYS = {
  sessionId: "squid-session-id",
  goal: "squid-goal",
  model: "squid-model",
  systemPrompt: "squid-system-prompt",
  theme: "squid-theme",
  activeWorkspace: "squid-active-workspace",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getDefaultTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = loadFromStorage<string | null>(STORAGE_KEYS.theme, null);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

interface OpenCodeMessage {
  info: { id: string; role: "user" | "assistant"; timestamp?: string };
  parts: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
}

function convertToUIMessages(serverMsgs: OpenCodeMessage[]): UIMessage[] {
  return serverMsgs.map((m) => {
    const parts: UIMessage["parts"] = [];

    for (const p of m.parts) {
      switch (p.type) {
        case "text":
          if (p.text) {
            parts.push({
              type: "text",
              text: p.text,
            } as unknown as UIMessage["parts"][0]);
          }
          break;
        case "reasoning":
          if (p.text) {
            parts.push({
              type: "reasoning",
              text: p.text,
            } as unknown as UIMessage["parts"][0]);
          }
          break;
        case "tool": {
          const toolPart = p as unknown as {
            callID: string;
            tool: string;
            state: {
              status: string;
              input?: unknown;
              output?: unknown;
              error?: string;
              attachments?: Array<{ type: string; url?: string; mime?: string }>;
            };
          };
          if (toolPart.state?.status === "completed" || toolPart.state?.status === "error") {
            parts.push({
              type: "tool-call",
              toolCallId: toolPart.callID,
              toolName: toolPart.tool,
              input: JSON.stringify(toolPart.state.input ?? {}),
              providerExecuted: true,
              dynamic: true,
            } as unknown as UIMessage["parts"][0]);
            parts.push({
              type: "tool-result",
              toolCallId: toolPart.callID,
              toolName: toolPart.tool,
              result:
                toolPart.state.status === "error"
                  ? toolPart.state.error ?? ""
                  : toolPart.state.output ?? "",
              isError: toolPart.state.status === "error",
              dynamic: true,
            } as unknown as UIMessage["parts"][0]);
          }
          break;
        }
        case "file": {
          const filePart = p as unknown as { url?: string; mime?: string; filename?: string };
          if (filePart.url) {
            parts.push({
              type: "file",
              data: filePart.url,
              mimeType: filePart.mime ?? "application/octet-stream",
              filename: filePart.filename,
            } as unknown as UIMessage["parts"][0]);
          }
          break;
        }
      }
    }

    return {
      id: m.info.id,
      role: m.info.role,
      parts,
      createdAt: m.info.timestamp ? new Date(m.info.timestamp) : undefined,
    } as unknown as UIMessage;
  });
}

export interface CreateWorkspaceResult extends WorkspaceEntry {
  dirPath: string;
  message: string;
}

export interface StudioChatState {
  messages: UIMessage[];
  sendMessage: (text: string, extraBody?: Record<string, unknown>) => void;
  stop: () => void;
  status: "idle" | "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  sessionId: string | null;
  sessionList: SessionSummary[];
  isLoadingSessions: boolean;
  resumeSession: (id: string) => Promise<void>;
  newSession: () => void;
  deleteSession: (id: string) => Promise<void>;
  goal: string;
  setGoal: (g: string) => void;
  model: string;
  setModel: (m: string) => void;
  systemPrompt: string | null;
  setSystemPrompt: (p: string | null) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  editMessage: (index: number) => string | null;
  regenerate: (index: number) => void;
  // Workspace
  workspaces: WorkspaceEntry[];
  activeWorkspace: WorkspaceEntry | null;
  isLoadingWorkspaces: boolean;
  isReconnecting: boolean;
  loadWorkspaces: () => Promise<void>;
  addWorkspace: (path: string) => Promise<WorkspaceEntry>;
  createWorkspace: (name: string, parentDir?: string, template?: string) => Promise<CreateWorkspaceResult>;
  switchWorkspace: (id: string) => Promise<{ workspacePath: string; workspaceName: string; devMode?: boolean; command?: string }>;
  removeWorkspace: (id: string) => Promise<void>;
}

export function useStudioChat(): StudioChatState {
  const [sessionId, setSessionIdState] = useState<string | null>(() =>
    loadFromStorage<string | null>(STORAGE_KEYS.sessionId, null),
  );
  const [goal, setGoalState] = useState<string>("");
  const [model, setModelState] = useState<string>(
    loadFromStorage<string>(STORAGE_KEYS.model, "opencode/big-pickle"),
  );
  const [systemPrompt, setSystemPromptState] = useState<string | null>(
    loadFromStorage<string | null>(STORAGE_KEYS.systemPrompt, null),
  );
  const [theme, setThemeState] = useState<"light" | "dark">(getDefaultTheme());
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [initialMessages] = useState<UIMessage[]>([]);
  const initialLoadRan = useRef(false);

  // Workspace state
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceEntry | null>(() =>
    loadFromStorage<WorkspaceEntry | null>(STORAGE_KEYS.activeWorkspace, null),
  );

  const goalRef = useRef(goal);
  const sessionIdRef = useRef(sessionId);
  const modelRef = useRef(model);
  const systemPromptRef = useRef(systemPrompt);

  useEffect(() => { goalRef.current = goal; }, [goal]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);

  // Track last seen sessionId across renders without triggering re-renders
  const lastSeenSessionIdRef = useRef<string | null>(null);

  const transport = useMemo(
    // eslint-disable-next-line react-hooks/refs -- safe: refs accessed only at call time
    () => new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            messages,
            sessionId: sessionIdRef.current || undefined,
            goal: goalRef.current || undefined,
            model: modelRef.current,
            systemPrompt: systemPromptRef.current || undefined,
          },
        };
      },
      // Intercept fetch to extract X-Session-Id from response headers.
      // When a new session is created on the server, the new sessionId
      // is sent back here and persisted to localStorage so subsequent
      // messages resume the same session.
      fetch: async (url, options) => {
        const response = await fetch(url, options);
        const headerSessionId = response.headers.get("X-Session-Id");
        if (headerSessionId && headerSessionId !== lastSeenSessionIdRef.current) {
          lastSeenSessionIdRef.current = headerSessionId;
          sessionIdRef.current = headerSessionId;
          saveToStorage(STORAGE_KEYS.sessionId, headerSessionId);
        }
        return response;
      },
    }),
    [],
  );

  const chat = useChat({
    messages: initialMessages,
    transport,
  });

  const setGoal = useCallback((g: string) => {
    setGoalState(g);
  }, []);

  const setModel = useCallback((m: string) => {
    setModelState(m);
    saveToStorage(STORAGE_KEYS.model, m);
  }, []);

  const setSystemPrompt = useCallback((p: string | null) => {
    setSystemPromptState(p);
    saveToStorage(STORAGE_KEYS.systemPrompt, p);
  }, []);

  const setTheme = useCallback((t: "light" | "dark") => {
    setThemeState(t);
    saveToStorage(STORAGE_KEYS.theme, t);
  }, []);

  const updateSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    saveToStorage(STORAGE_KEYS.sessionId, id);
    sessionIdRef.current = id;
  }, []);

  // Workspace functions
  const loadWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const res = await fetch("/api/workspace/list");
      if (res.ok) {
        const data: WorkspaceEntry[] = await res.json();
        setWorkspaces(data);
      }
    } catch (e) {
      console.warn("Failed to load workspaces:", e);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, []);

  const addWorkspace = useCallback(async (folderPath: string): Promise<WorkspaceEntry> => {
    const res = await fetch("/api/workspace/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: folderPath }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to add workspace");
    }
    const data = await res.json();
    setWorkspaces((prev) => {
      const filtered = prev.filter((w) => w.id !== data.workspace.id);
      return [data.workspace, ...filtered];
    });
    return data.workspace as WorkspaceEntry;
  }, []);

  const createWorkspace = useCallback(async (
    name: string,
    parentDir?: string,
    template?: string,
  ): Promise<CreateWorkspaceResult> => {
    const res = await fetch("/api/workspace/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentDir, template }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to create workspace");
    }
    const data = await res.json();
    setWorkspaces((prev) => {
      const filtered = prev.filter((w) => w.id !== data.workspace.id);
      return [data.workspace, ...filtered];
    });
    return { ...data.workspace, dirPath: data.dirPath, message: data.message } as CreateWorkspaceResult;
  }, []);

  interface SwitchResult {
    workspacePath: string;
    workspaceName: string;
    devMode?: boolean;
    command?: string;
  }

  const switchWorkspace = useCallback(async (id: string): Promise<SwitchResult> => {
    try {
      const res = await fetch("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });

      if (res.status === 410) {
        // Directory no longer exists — the API returns error info
        const errData = await res.json();
        throw errData;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "Failed to switch workspace");
      }

      const data = await res.json();

      // Look up the workspace entry and persist it
      const entry = workspaces.find((w) => w.id === id);
      if (entry) {
        setActiveWorkspace(entry);
        saveToStorage(STORAGE_KEYS.activeWorkspace, entry);
      }

      if (data.devMode) {
        // Dev mode — no server restart. Save the workspace selection
        // locally and return the command so the UI shows a handoff dialog.
        chat.setMessages([]);
        updateSessionId(null);
        await loadWorkspaces();
        return data as SwitchResult;
      }

      setIsReconnecting(true);

      // Poll health endpoint until the server is back
      const pollHealth = async (): Promise<void> => {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          try {
            const healthRes = await fetch("/api/health");
            if (healthRes.ok) {
              setIsReconnecting(false);
              // Reset chat state for the new workspace
              chat.setMessages([]);
              updateSessionId(null);
              await loadWorkspaces();
              return;
            }
          } catch {
            // Server still restarting — keep polling
          }
        }
        // Timeout
        setIsReconnecting(false);
        console.warn("Reconnection timed out after 60s");
      };
      pollHealth();
      return data as SwitchResult;
    } catch (e) {
      setIsReconnecting(false);
      throw e;
    }
  }, [workspaces, chat.setMessages, updateSessionId, loadWorkspaces]);

  const removeWorkspace = useCallback(async (id: string) => {
    // Optimistic UI removal
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    if (activeWorkspace?.id === id) {
      setActiveWorkspace(null);
      saveToStorage(STORAGE_KEYS.activeWorkspace, null);
    }
    // Persist via API
    try {
      await fetch("/api/workspace/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
    } catch (e) {
      console.warn("Failed to remove workspace via API:", e);
      // Rollback on failure
      loadWorkspaces();
    }
  }, [activeWorkspace, loadWorkspaces]);

  const fetchSessionList = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/sessions?limit=50");
      if (res.ok) {
        const data = await res.json();
        setSessionList(
          (data as Array<{ id: string; title?: string; created?: string }>).map((s) => ({
            id: s.id,
            title: s.title,
            created: s.created,
          })),
        );
      } else {
        console.warn("Failed to fetch session list:", res.status);
      }
    } catch (e) {
      console.warn("Failed to fetch session list:", e);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const sendMessage = useCallback(
    (text: string, extraBody?: Record<string, unknown>) => {
      chat.sendMessage({ text }, { body: extraBody });
    },
    [chat.sendMessage],
  );

  const newSession = useCallback(() => {
    updateSessionId(null);
    chat.setMessages([]);
    setGoal("");
  }, [chat.setMessages, updateSessionId]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionID: id }),
      });
      if (!res.ok) {
        console.warn("Failed to delete session:", id, res.status);
      }
      setSessionList((prev) => prev.filter((s) => s.id !== id));
      if (sessionIdRef.current === id) {
        updateSessionId(null);
        chat.setMessages([]);
      }
    } catch (e) {
      console.warn("Failed to delete session:", id, e);
    }
  }, [chat.setMessages, updateSessionId]);

  const resumeSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/sessions/${id}/messages`);
        if (!res.ok) {
          console.warn("Failed to resume session:", id, res.status);
          return;
        }
        const data: OpenCodeMessage[] = await res.json();
        const uiMessages = convertToUIMessages(data);
        updateSessionId(id);
        chat.setMessages(uiMessages);
      } catch (e) {
        console.warn("Failed to resume session:", id, e);
      }
    },
    [chat.setMessages, updateSessionId],
  );

  useEffect(() => {
    if (initialLoadRan.current) return;
    initialLoadRan.current = true;
    (async () => {
      if (sessionId) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/messages`);
          if (res.ok) {
            const data: OpenCodeMessage[] = await res.json();
            const uiMessages = convertToUIMessages(data);
            chat.setMessages(uiMessages);
          } else {
            console.warn("Failed to load session messages, starting fresh:", sessionId);
          }
        } catch (e) {
          console.warn("Failed to load session messages, starting fresh:", e);
        }
      }
      try {
        const res = await fetch("/api/sessions?limit=50");
        if (res.ok) {
          const data = await res.json();
          setSessionList(
            (data as Array<{ id: string; title?: string; created?: string }>).map((s) => ({
              id: s.id,
              title: s.title,
              created: s.created,
            })),
          );
        }
      } catch (e) {
        console.warn("Failed to load session list:", e);
      }
      // Load workspaces
      try {
        const res = await fetch("/api/workspace/list");
        if (res.ok) {
          const data: WorkspaceEntry[] = await res.json();
          setWorkspaces(data);
        }
      } catch (e) {
        console.warn("Failed to load workspace list:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (chat.status === "ready" && sessionIdRef.current) {
      fetchSessionList();
    }
  }, [chat.status, fetchSessionList]);

  const editMessage = useCallback(
    (index: number): string | null => {
      const target = chat.messages[index];
      if (!target || target.role !== "user") return null;
      const textPart = target.parts.find((p) => p.type === "text");
      const text = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
      chat.setMessages((prev) => prev.slice(0, index));
      return text;
    },
    [chat.messages, chat.setMessages],
  );

  const regenerate = useCallback(
    (index: number) => {
      chat.setMessages((prev) => prev.slice(0, index));
      const prevMsg = chat.messages[index - 1];
      if (prevMsg && prevMsg.role === "user") {
        const textPart = prevMsg.parts.find((p) => p.type === "text");
        const text = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
        if (text) {
          chat.sendMessage({ text });
        }
      }
    },
    [chat.messages, chat.setMessages, chat.sendMessage],
  );

  return {
    messages: chat.messages,
    sendMessage,
    stop: chat.stop,
    status: chat.status,
    error: chat.error,
    sessionId,
    sessionList,
    isLoadingSessions,
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
    // Workspace
    workspaces,
    activeWorkspace,
    isLoadingWorkspaces,
    isReconnecting,
    loadWorkspaces,
    addWorkspace,
    createWorkspace,
    switchWorkspace,
    removeWorkspace,
  };
}
