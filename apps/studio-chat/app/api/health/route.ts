import { NextResponse } from "next/server";
import { getOpencodeClient } from "@/app/lib/opencode-client";

export async function GET() {
  try {
    const client = getOpencodeClient();
    const result = await client.global.health();
    const data = result.data;
    if (result.error) {
      return NextResponse.json({ healthy: false, error: result.error }, { status: 503 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("Health check API exception:", message);
    return NextResponse.json(
      { healthy: false, error: message },
      { status: 503 }
    );
  }
}
