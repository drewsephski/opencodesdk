import { NextResponse } from "next/server";
import { listWorkspaces } from "@/app/lib/workspace";

export async function GET() {
  try {
    const workspaces = listWorkspaces();
    return NextResponse.json(workspaces);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace list API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
