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

/**
 * Reset the client singleton. Useful for development/testing or
 * when the server URL changes at runtime.
 */
export function resetOpencodeClient() {
  client = null;
}
