import { NextResponse } from "next/server";
import { getOpencodeClient, getOpenCodeServerUrl } from "@/app/lib/opencode-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const search = searchParams.get("search") ?? undefined;

    const client = getOpencodeClient();
    const result = await client.session.list({ limit, search });
    if (result.error) {
      console.warn("Session list API error:", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.data ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Session list API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { sessionID } = await request.json();
    if (!sessionID) {
      return NextResponse.json({ error: "sessionID is required" }, { status: 400 });
    }

    const client = getOpencodeClient();
    const result = await client.session.delete({ sessionID });
    if (result.error) {
      console.warn("Session delete API error:", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Session delete API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
