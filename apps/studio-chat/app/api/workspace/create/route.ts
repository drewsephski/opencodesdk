import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createWorkspaceDir, isSquidChatRunning } from "@/app/lib/workspace";

const DEFAULT_PARENT = join(homedir(), "Desktop");

export async function POST(request: Request) {
  try {
    const { name, parentDir, template } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    // Sanitize name: only allow safe filename characters
    const safeName = name.trim().replace(/[^a-zA-Z0-9_\-\. ]/g, "_");
    if (!safeName) {
      return NextResponse.json(
        { error: "Invalid project name" },
        { status: 400 },
      );
    }

    const dir = parentDir?.trim() || DEFAULT_PARENT;
    if (!existsSync(dir)) {
      return NextResponse.json(
        { error: `Parent directory does not exist: ${dir}` },
        { status: 404 },
      );
    }

    const validTemplates = ["empty", "node"] as const;
    const tmpl = validTemplates.includes(template) ? template : "empty";

    const { entry, dirPath } = createWorkspaceDir({
      name: safeName,
      parentDir: dir,
      template: tmpl,
    });

    return NextResponse.json({
      success: true,
      workspace: entry,
      dirPath,
      devMode: !isSquidChatRunning(),
      message: `Created workspace: ${entry.name}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace create API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
