import { createOpencodeClient } from "@opencode-ai/sdk/v2";

export function getOpenCodeServerUrl(): string {
  return process.env.OPENCODE_SERVER_URL ?? "http://127.0.0.1:4096";
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

/**
 * Call an SDK function with automatic reconnection on connection failure.
 * After a workspace switch the OpenCode server restarts, so the client
 * singleton may hold stale connections. This helper resets and retries once.
 */
export async function withClient<T>(
  fn: (client: ReturnType<typeof createOpencodeClient>) => Promise<T>,
): Promise<T> {
  try {
    return await fn(getOpencodeClient());
  } catch (e) {
    // Connection-level errors (server restart, network blip) — reconnect once
    if (e instanceof TypeError && (e as Error).message?.includes("fetch")) {
      console.warn("OpenCode client connection failed, reconnecting...");
      resetOpencodeClient();
      return await fn(getOpencodeClient());
    }
    throw e;
  }
}
