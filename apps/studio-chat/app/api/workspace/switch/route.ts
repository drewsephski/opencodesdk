import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { getWorkspace, writeRestartMarker, isSquidChatRunning } from "@/app/lib/workspace";

export async function POST(request: Request) {
  try {
    const { workspaceId }: { workspaceId: string } = await request.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 },
      );
    }

    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Check if the directory still exists
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

    // Check if squid-chat CLI is running (dev mode vs managed)
    if (!isSquidChatRunning()) {
      return NextResponse.json({
        success: true,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        devMode: true,
        message:
          `Open your terminal and run:\ncd ${workspace.path} && npx squid-chat\n\nto start chatting in this project.`,
      });
    }

    // Write restart marker so the squid-chat CLI process picks it up
    writeRestartMarker(workspace.id, workspace.path);

    return NextResponse.json({
      success: true,
      workspacePath: workspace.path,
      workspaceName: workspace.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace switch API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
