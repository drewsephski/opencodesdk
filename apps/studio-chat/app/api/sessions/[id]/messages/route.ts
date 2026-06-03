import { NextResponse } from "next/server";
import { getOpencodeClient } from "@/app/lib/opencode-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getOpencodeClient();
    const result = await client.session.messages({ sessionID: id });
    if (result.error) {
      console.warn("Session messages API error:", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.data ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Session messages API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
