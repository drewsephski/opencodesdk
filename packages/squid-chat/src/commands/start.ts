import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, accessSync, constants } from "fs";
import { createServer } from "net";
import { join, dirname } from "path";
import { startOpencodeServer } from "../opencode-server.js";
import { loadConfig } from "../config.js";
import { loadState, saveState, clearState, isProcessAlive } from "../state.js";
import { OPENCODE_BIN, UI_DIR, RESTART_MARKER_PATH, SQUID_CHAT_DIR } from "../paths.js";
import { ensureOpencodeBinary } from "../download.js";
import { healthCheck } from "../health.js";
import { detectProject } from "../project.js";
import { ManifestManager } from "../manifest.js";
import { WorkspaceManager } from "../workspace.js";

/** Path where the UI server writes its listening port for deterministic detection */
const UI_PORT_FILE = join(SQUID_CHAT_DIR, "run", "ui-port.json");

export async function startCommand(cwd?: string, previousUIPort?: number): Promise<void> {
  const config = loadConfig();

  const serverCwd = cwd ?? process.cwd();

  // Validate serverCwd exists and is accessible
  if (!existsSync(serverCwd)) {
    console.error(`  Directory does not exist: ${serverCwd}`);
    process.exit(1);
  }
  try {
    accessSync(serverCwd, constants.R_OK | constants.X_OK);
  } catch {
    console.error(`  No read/execute permission on directory: ${serverCwd}`);
    process.exit(1);
  }

  const opencodeHost = config.opencodeHostname;
  const opencodePort = config.opencodePort;

  // ── Fast path: if the SAME squid-chat is already running in this directory, just reopen ──
  const existing = loadState();
  if (existing && isProcessAlive(existing.pid) && existing.cwd === serverCwd) {
    console.log(`\u2713 squid-chat already running at ${existing.url}`);
    try {
      execSync(`open "${existing.url}"`, { stdio: "ignore" });
    } catch {}
    return;
  }

  // ── Normal path: always start fresh ──────────────────────────────────────
  // 1. Clear stale state
  clearState();

  // 2. Verify the manifest
  const manifest = new ManifestManager();
  if (!manifest.isInstalled()) {
    console.log("squid-chat is not installed. Run `squid-chat install` first.");
    process.exit(1);
  }

  const opencodeUrl = `http://${opencodeHost}:${opencodePort}`;

  // 3. Ensure the OpenCode port is free.
  //    Any existing process on this port is orphaned or serving a different
  //    project — kill it so we can start with a clean server in the right dir.
  if (!(await checkPortFree(opencodePort, opencodeHost))) {
    console.log("  Clearing previous OpenCode server...");
    await killProcessOnPort(opencodePort);
    await waitForPortFree(opencodePort, opencodeHost, 8000);
  }

  // 4. Verify / download the binary
  if (!existsSync(OPENCODE_BIN)) {
    console.log("  Downloading OpenCode binary...");
    await ensureOpencodeBinary();
  } else {
    try {
      accessSync(OPENCODE_BIN, constants.X_OK);
    } catch {
      console.log("  OpenCode binary not executable, re-downloading...");
      await ensureOpencodeBinary({ forceUpgrade: true });
    }
  }

  // 5. Start a fresh OpenCode server in the target directory.
  //    Unlike the SDK's createOpencodeServer (which has no `cwd` option and
  //    relies on process.chdir()), we spawn the binary directly with an explicit
  //    working directory.  No global state mutation needed.
  const opencodeAbortController = new AbortController();

  console.log("  Starting OpenCode server...");
  const opencodeServer = await startOpencodeServer({
    hostname: opencodeHost,
    port: opencodePort,
    cwd: serverCwd,
    signal: opencodeAbortController.signal,
  });

  const activeOpencodeUrl = opencodeServer.url;

  console.log("  Starting UI server...");
  const uiDir = UI_DIR;
  const { port: uiPort, serverProcess } = await startUIServer(uiDir, activeOpencodeUrl, previousUIPort);

  const uiUrl = `http://127.0.0.1:${uiPort}`;

  console.log("  Verifying health...");
  const healthy = await healthCheck(uiUrl, activeOpencodeUrl);
  if (!healthy) {
    console.error("  Health check failed");
    opencodeServer.close();
    serverProcess?.kill();
    process.exit(1);
  }

  // Auto-detect project and add to workspace list
  const project = await detectProject(serverCwd);
  const wm = new WorkspaceManager();
  if (project) {
    console.log(`  Project detected: ${project.name} (${project.framework})`);
    const existingWs = wm.findByPath(serverCwd);
    if (!existingWs) {
      wm.add({
        path: serverCwd,
        name: project.name,
        projectName: project.name,
        framework: project.framework,
        language: project.language,
      });
      console.log(`  Added workspace: ${project.name}`);
    } else {
      wm.touch(existingWs.id);
    }
  }

  saveState({
    pid: process.pid,
    url: uiUrl,
    startedAt: Date.now(),
    cwd: serverCwd,
    uiPort,
  });

  console.log(`\n\u2713 squid-chat running at ${uiUrl}`);
  try {
    execSync(`open "${uiUrl}"`, { stdio: "ignore" });
  } catch {}

  // Graceful shutdown
  let shuttingDown = false;

  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    opencodeAbortController.abort();
    opencodeServer.close();
    serverProcess?.kill();
    clearState();
  }

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    shutdown();
    process.exit(0);
  });

  // Watch for restart marker — poll every 2 seconds
  const restartInterval = setInterval(async () => {
    if (!existsSync(RESTART_MARKER_PATH)) return;

    let marker: { cwd?: string; workspaceId?: string; timestamp?: number; uiPort?: number };
    try {
      marker = JSON.parse(readFileSync(RESTART_MARKER_PATH, "utf-8"));
    } catch {
      return; // Malformed — skip
    }

    if (!marker.cwd || marker.cwd === serverCwd) return;

    clearInterval(restartInterval);
    console.log(`\nSwitching to workspace: ${marker.cwd}`);
    try {
      unlinkSync(RESTART_MARKER_PATH);
    } catch {
      // Ignore if already deleted
    }

    // Shutdown old servers
    shutdown();

    // Wait briefly for port to be released
    await new Promise((r) => setTimeout(r, 500));

    // Restart with the new CWD, reusing the same UI port if available
    try {
      await startCommand(marker.cwd, marker.uiPort ?? uiPort);
    } catch (err) {
      console.error("  Failed to restart with new workspace:", err instanceof Error ? err.message : err);
      console.error("  The old instance has been shut down. Run `squid-chat start` to restart.");
      process.exit(1);
    }
  }, 2000);

  await new Promise(() => {});
}

async function startUIServer(
  uiDir: string,
  opencodeUrl: string,
  preferredPort?: number,
): Promise<{ port: number; serverProcess?: import("child_process").ChildProcess }> {
  const serverJs = `${uiDir}/server.js`;
  if (!existsSync(serverJs)) {
    throw new Error(`UI not found at ${uiDir}. Run \`squid-chat install\` first.`);
  }

  // First, check if a recent port file exists from a previous run
  if (!preferredPort && existsSync(UI_PORT_FILE)) {
    try {
      const prev = JSON.parse(readFileSync(UI_PORT_FILE, "utf-8"));
      if (prev.port && typeof prev.port === "number") {
        preferredPort = prev.port;
      }
    } catch {
      // Ignore stale port file
    }
  }

  const port = preferredPort ? String(preferredPort) : "0";
  const child = spawn("node", ["server.js"], {
    cwd: uiDir,
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: "127.0.0.1",
      OPENCODE_SERVER_URL: opencodeUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const actualPort = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for UI server")), 15000);
    let buffer = "";
    child.stdout?.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(parseInt(match[1], 10));
      }
      const portMatch = buffer.match(/port\s+(\d+)/i);
      if (portMatch) {
        clearTimeout(timeout);
        resolve(parseInt(portMatch[1], 10));
      }
    });
    child.stderr?.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(parseInt(match[1], 10));
      }
    });
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`UI server exited with code ${code}`));
    });
  });

  // Write the detected port to a known file for deterministic future lookups
  // (instead of relying on stdout scraping during restart)
  try {
    const dir = dirname(UI_PORT_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(UI_PORT_FILE, JSON.stringify({ port: actualPort, startedAt: Date.now() }));
  } catch {
    // Non-critical — stdout scraping will still work on next restart as fallback
  }

  return { port: actualPort, serverProcess: child };
}

/**
 * Poll until a TCP port is free (not in use) or the timeout is reached.
 * Used when replacing an old squid-chat instance — we need to wait for its
 * OpenCode server port to be released before we can start our own.
 */
async function waitForPortFree(port: number, host: string, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, host);
    });
    if (free) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  // Timeout — log a warning and proceed anyway; the port check later will catch it
  console.warn(`  Warning: port ${port} did not become free within ${timeout}ms, proceeding anyway`);
}

/**
 * Check whether a TCP port is free (not in use).
 */
async function checkPortFree(port: number, host: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Find the process(es) listening on a TCP port and kill them with SIGTERM.
 * Uses `lsof` on macOS/Linux where available. Falls back gracefully with a
 * warning — the port check after this call will catch conflicts.
 */
async function killProcessOnPort(port: number): Promise<void> {
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 5000,
    })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number);

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Already gone — ignore
      }
    }
  } catch (e) {
    // lsof unavailable (Windows, containers, etc.) — warn and proceed
    const err = e as Error;
    if (err.message?.includes("lsof")) {
      console.warn(`  Warning: lsof not available, cannot auto-clear port ${port}. If the port is in use, try killing manually.`);
    }
    // If lsof is available but found no process, exit code is 1 — silently ignore
  }
}
