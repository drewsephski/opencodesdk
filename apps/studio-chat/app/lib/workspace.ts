import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { randomUUID } from "crypto";
import { homedir } from "os";
import { join, dirname, basename } from "path";

const WORKSPACES_PATH = join(homedir(), ".squid-chat", "workspaces", "workspaces.json");
const RESTART_MARKER_PATH = join(homedir(), ".squid-chat", "run", "restart.json");

export interface WorkspaceEntry {
  id: string;
  path: string;
  name: string;
  projectName?: string;
  framework?: string;
  language?: string;
  lastOpened: number;
  createdAt: number;
}

export function listWorkspaces(): WorkspaceEntry[] {
  try {
    if (existsSync(WORKSPACES_PATH)) {
      return JSON.parse(readFileSync(WORKSPACES_PATH, "utf-8"));
    }
  } catch {
    // Corrupt or missing
  }
  return [];
}

export function getWorkspace(id: string): WorkspaceEntry | null {
  return listWorkspaces().find((e) => e.id === id) ?? null;
}

function detectProjectName(absPath: string): {
  name: string;
  framework?: string;
  language?: string;
} | null {
  try {
    const pkgPath = join(absPath, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
      let framework: string | undefined;
      if (deps.next) framework = `Next.js ${deps.next}`;
      else if (deps.vite) framework = "Vite";
      else if (existsSync(join(absPath, "pubspec.yaml"))) framework = "Flutter";
      else framework = "Node.js";
      return {
        name: pkg.name || basename(absPath),
        framework,
        language: deps.typescript ? "TypeScript" : "JavaScript",
      };
    }
    // Check for other project types
    if (existsSync(join(absPath, "Cargo.toml"))) return { name: basename(absPath), framework: "Rust" };
    if (existsSync(join(absPath, "go.mod"))) return { name: basename(absPath), framework: "Go" };
    if (existsSync(join(absPath, "Gemfile"))) return { name: basename(absPath), framework: "Ruby" };
    if (readdirSync(absPath).some((f) => f.endsWith(".py"))) return { name: basename(absPath), framework: "Python" };
  } catch {}
  return null;
}

export function addWorkspaceFile(absPath: string): { entry: WorkspaceEntry; created: boolean } {
  const existing = listWorkspaces().find((e) => e.path === absPath);
  if (existing) {
    // Update lastOpened and refresh project info
    existing.lastOpened = Date.now();
    const info = detectProjectName(absPath);
    if (info) {
      existing.projectName = info.name;
      existing.framework = info.framework;
      existing.language = info.language;
    }
    const dir = dirname(WORKSPACES_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const all = listWorkspaces().map((e) => (e.id === existing.id ? existing : e));
    writeFileSync(WORKSPACES_PATH, JSON.stringify(all, null, 2));
    return { entry: existing, created: false };
  }

  const info = detectProjectName(absPath);
  const entry: WorkspaceEntry = {
    id: randomUUID(),
    path: absPath,
    name: info?.name ?? basename(absPath),
    projectName: info?.name,
    framework: info?.framework,
    language: info?.language,
    lastOpened: Date.now(),
    createdAt: Date.now(),
  };
  const all = listWorkspaces();
  all.push(entry);
  const dir = dirname(WORKSPACES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(WORKSPACES_PATH, JSON.stringify(all, null, 2));
  return { entry, created: true };
}

export type WorkspaceTemplate = "empty" | "node";

export interface CreateWorkspaceOptions {
  name: string;
  parentDir: string;
  template?: WorkspaceTemplate;
}

export function createWorkspaceDir(opts: CreateWorkspaceOptions): {
  entry: WorkspaceEntry;
  dirPath: string;
} {
  const dirPath = join(opts.parentDir, opts.name);

  if (existsSync(dirPath)) {
    throw new Error(`Directory already exists: ${dirPath}`);
  }

  // Create the directory
  mkdirSync(dirPath, { recursive: true });

  // Optionally scaffold
  if (opts.template === "node") {
    const pkg = {
      name: opts.name,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: { start: "node index.js" },
    };
    writeFileSync(join(dirPath, "package.json"), JSON.stringify(pkg, null, 2));
    writeFileSync(join(dirPath, "index.js"), "console.log('Hello from " + opts.name + "!');\n");
  }

  // Add to workspace list
  const { entry } = addWorkspaceFile(dirPath);
  return { entry, dirPath };
}

export function removeWorkspaceFile(id: string): boolean {
  const entries = listWorkspaces();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  const dir = dirname(WORKSPACES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(WORKSPACES_PATH, JSON.stringify(entries, null, 2));
  return true;
}

export function isSquidChatRunning(): boolean {
  try {
    const statePath = join(homedir(), ".squid-chat", "run", "state.json");
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      // Check if the process is alive (Unix signal 0)
      try {
        process.kill(state.pid, 0);
        return true;
      } catch {
        return false;
      }
    }
  } catch {}
  return false;
}

export function writeRestartMarker(workspaceId: string, cwd: string): void {
  // Read current state to include the UI port so the restart reuses it
  let currentUiPort: number | undefined;
  try {
    const statePath = join(homedir(), ".squid-chat", "run", "state.json");
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      currentUiPort = state.uiPort;
    }
  } catch {}

  const dir = dirname(RESTART_MARKER_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    RESTART_MARKER_PATH,
    JSON.stringify({ cwd, workspaceId, timestamp: Date.now(), uiPort: currentUiPort }),
  );
}
