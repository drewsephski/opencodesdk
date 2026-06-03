import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { getWorkspace, writeRestartMarker, isSquidChatRunning } from "@/app/lib/workspace";

export async function POST(request: Request) {
  try {
    const { workspaceId }: { workspaceId: string } = await request.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (!existsSync(workspace.path)) {
      return NextResponse.json(
        {
          error: "Workspace directory no longer exists",
          workspace: { id: workspace.id, name: workspace.name, path: workspace.path },
          options: ["remove", "relink"],
        },
        { status: 410 },
      );
    }

    if (isSquidChatRunning()) {
      // CLI running — restart marker approach (seamless reconnect)
      writeRestartMarker(workspace.id, workspace.path);
      return NextResponse.json({
        success: true,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
      });
    }

    // Dev mode — return workspace info so the UI shows the handoff command
    return NextResponse.json({
      success: true,
      workspacePath: workspace.path,
      workspaceName: workspace.name,
      devMode: true,
      command: `cd ${workspace.path} && npx squid-chat`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace switch API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
