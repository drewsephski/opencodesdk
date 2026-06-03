import { existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { WorkspaceManager, type WorkspaceEntry } from "../workspace.js";
import { detectProject } from "../project.js";
import { RESTART_MARKER_PATH, WORKSPACES_DIR } from "../paths.js";

const manager = new WorkspaceManager();

function printWorkspaceTable(entries: WorkspaceEntry[]): void {
  if (entries.length === 0) {
    console.log("No workspaces found.");
    return;
  }

  // Header
  console.log(
    "  ID".padEnd(38) +
    "Name".padEnd(22) +
    "Framework".padEnd(20) +
    "Last Opened".padEnd(18) +
    "Path",
  );
  console.log("  " + "-".repeat(120));

  for (const e of entries) {
    const shortId = e.id.slice(0, 8) + "…";
    const date = new Date(e.lastOpened).toLocaleDateString();
    const displayPath = e.path.length > 50 ? "…" + e.path.slice(-47) : e.path;
    console.log(
      `  ${shortId.padEnd(38)}` +
      `${(e.name || "untitled").padEnd(22)}` +
      `${(e.framework || "-").padEnd(20)}` +
      `${date.padEnd(18)}` +
      `${displayPath}`,
    );
  }
}

export async function workspaceCommand(args: string[]): Promise<void> {
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case "add": {
      const rawPath = args[1];
      if (!rawPath) {
        console.error("Usage: squid-chat workspace add <path>");
        process.exit(1);
      }
      const absPath = resolve(rawPath);
      if (!existsSync(absPath)) {
        console.error(`Path does not exist: ${absPath}`);
        process.exit(1);
      }

      const project = await detectProject(absPath);
      const entry = manager.add({
        path: absPath,
        name: project?.name ?? (absPath.split("/").pop() || "project"),
        projectName: project?.name,
        framework: project?.framework,
        language: project?.language,
      });

      const projectInfo = project
        ? ` (${project.name}, ${project.framework})`
        : " (no project detected)";
      console.log(`Added workspace: ${entry.name}${projectInfo}`);
      console.log(`  ID:   ${entry.id}`);
      console.log(`  Path: ${absPath}`);
      break;
    }

    case "list": {
      const entries = manager.list();
      printWorkspaceTable(entries);
      break;
    }

    case "remove": {
      const id = args[1];
      if (!id) {
        console.error("Usage: squid-chat workspace remove <id>");
        process.exit(1);
      }
      const entry = manager.get(id);
      if (!entry) {
        console.error(`Workspace not found: ${id}`);
        process.exit(1);
      }
      manager.remove(id);
      console.log(`Removed workspace: ${entry.name} (${entry.path})`);
      break;
    }

    case "switch": {
      const id = args[1];
      if (!id) {
        console.error("Usage: squid-chat workspace switch <id>");
        process.exit(1);
      }
      const entry = manager.get(id);
      if (!entry) {
        console.error(`Workspace not found: ${id}`);
        process.exit(1);
      }

      if (!existsSync(entry.path)) {
        console.error(`Workspace directory no longer exists: ${entry.path}`);
        console.error("  Run `squid-chat workspace remove` to remove it, or re-add the correct path.");
        process.exit(1);
      }

      // Update last opened
      manager.touch(id);

      // Write restart marker so the running process picks it up
      const dir = dirname(RESTART_MARKER_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(
        RESTART_MARKER_PATH,
        JSON.stringify({
          cwd: entry.path,
          workspaceId: id,
          timestamp: Date.now(),
        }),
      );

      console.log(`Switching to workspace: ${entry.name}`);
      console.log(`  Path: ${entry.path}`);
      console.log("  Restart marker written. The running instance will restart shortly.");

      // If running as a standalone command (no running instance), restart ourselves
      // by re-executing squid-chat in the new directory
      process.exit(0);
      break;
    }

    default:
      console.log(`Usage: squid-chat workspace <add|list|remove|switch> [args]

Commands:
  add <path>          Add a folder as a workspace
  list                List all workspaces
  remove <id>         Remove a workspace
  switch <id>         Switch to a different workspace
`);
      break;
  }
}
