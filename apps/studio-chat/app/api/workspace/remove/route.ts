import { NextResponse } from "next/server";
import { removeWorkspaceFile } from "@/app/lib/workspace";

export async function DELETE(request: Request) {
  try {
    const { workspaceId }: { workspaceId: string } = await request.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 },
      );
    }

    const removed = removeWorkspaceFile(workspaceId);
    if (!removed) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace remove API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
