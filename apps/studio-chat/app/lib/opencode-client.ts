import { createOpencodeClient } from "@opencode-ai/sdk/v2";

// Runtime-configurable active OpenCode server URL.
// Defaults to the env-var at startup, but can be swapped at runtime
// when switching workspaces.
let activeUrl: string | null = null;

export function getOpenCodeServerUrl(): string {
  return activeUrl ?? process.env.OPENCODE_SERVER_URL ?? "http://127.0.0.1:4096";
}

/**
 * Update the active OpenCode server URL at runtime.
 * Used when switching workspaces in dev mode (spawning a new server)
 * or when the CLI restarts with a new workspace (receiving the new URL).
 */
export function setOpenCodeServerUrl(url: string): void {
  activeUrl = url;
  // Reset the client so it picks up the new URL on next use
  client = null;
}

let client: ReturnType<typeof createOpencodeClient> | null = null;

export function getOpencodeClient() {
  if (!client) {
    client = createOpencodeClient({ baseUrl: getOpenCodeServerUrl() });
  }
  return client;
}

export function resetOpencodeClient() {
  client = null;
}
