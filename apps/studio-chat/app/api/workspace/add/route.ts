import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { resolve } from "path";
import { addWorkspaceFile } from "@/app/lib/workspace";

export async function POST(request: Request) {
  try {
    const { path: folderPath }: { path: string } = await request.json();

    if (!folderPath?.trim()) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 },
      );
    }

    const absPath = resolve(folderPath.trim());

    if (!existsSync(absPath)) {
      return NextResponse.json(
        { error: `Directory does not exist: ${absPath}` },
        { status: 404 },
      );
    }

    const { entry, created } = addWorkspaceFile(absPath);

    return NextResponse.json({
      success: true,
      workspace: entry,
      created,
      message: created
        ? `Added workspace: ${entry.name}`
        : `Updated workspace: ${entry.name}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Workspace add API exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
