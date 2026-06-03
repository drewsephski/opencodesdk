import { createOpencodeClient } from "@opencode-ai/sdk/v2";

const OPENCODE_SERVER_URL =
  process.env.OPENCODE_SERVER_URL ?? "http://127.0.0.1:4096";

let client: ReturnType<typeof createOpencodeClient> | null = null;

export function getOpencodeClient() {
  if (!client) {
    client = createOpencodeClient({ baseUrl: OPENCODE_SERVER_URL });
  }
  return client;
}
