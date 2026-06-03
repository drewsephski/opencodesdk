import { NextResponse } from "next/server";
import { getOpencodeClient } from "@/app/lib/opencode-client";

export async function GET() {
  try {
    const client = getOpencodeClient();
    const result = await client.mcp.status();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.data ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("MCP status API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
