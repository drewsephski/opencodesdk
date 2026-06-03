import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { createServer } from "net";
import { createOpencodeServer } from "@opencode-ai/sdk";
import { getWorkspace, writeRestartMarker, isSquidChatRunning } from "@/app/lib/workspace";
import { setOpenCodeServerUrl } from "@/app/lib/opencode-client";

// Track the OpenCode server we spawned for the current workspace
// so we can close it when switching to another.
let currentWorkspaceServer: { url: string; close: () => void } | null = null;

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("listening", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not determine port")));
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1");
  });
}

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

    // Write restart marker so the squid-chat CLI process picks it up
    writeRestartMarker(workspace.id, workspace.path);

    const result: {
      success: true;
      workspacePath: string;
      workspaceName: string;
      devMode?: boolean;
      opencodeUrl?: string;
    } = {
      success: true,
      workspacePath: workspace.path,
      workspaceName: workspace.name,
    };

    if (isSquidChatRunning()) {
      // CLI is running — the restart marker will be picked up and the
      // UI will reconnect via health polling on the same URL. Done.
      return NextResponse.json(result);
    }

    // ---- Dev mode: spawn a new OpenCode server for this workspace ----
    result.devMode = true;

    // Close the previous workspace server if any
    if (currentWorkspaceServer) {
      try { currentWorkspaceServer.close(); } catch {}
      currentWorkspaceServer = null;
    }

    const oldCwd = process.cwd();
    try {
      // Change to the workspace directory so the OpenCode server
      // picks it up as its project root.
      process.chdir(workspace.path);

      const port = await findAvailablePort();
      const server = await createOpencodeServer({
        hostname: "127.0.0.1",
        port,
      });

      currentWorkspaceServer = server;
      result.opencodeUrl = server.url;

      // Tell the in-process client to use this new URL
      setOpenCodeServerUrl(server.url);
    } catch (err) {
      console.warn("Failed to spawn workspace OpenCode server:", err);
      // Non-fatal: the user can still manually start squid-chat in the workspace
    } finally {
      // Restore CWD so other API routes aren't affected
      process.chdir(oldCwd);
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace switch API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
