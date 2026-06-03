import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync, accessSync, constants } from "fs";
import { createServer } from "net";
import { createOpencodeServer } from "@opencode-ai/sdk";
import { loadConfig } from "../config.js";
import { loadState, saveState, clearState, isProcessAlive } from "../state.js";
import { OPENCODE_BIN, UI_DIR, RESTART_MARKER_PATH } from "../paths.js";
import { ensureOpencodeBinary } from "../download.js";
import { healthCheck } from "../health.js";
import { detectProject } from "../project.js";
import { ManifestManager } from "../manifest.js";
import { WorkspaceManager } from "../workspace.js";

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

  // Check if an existing instance is running — if so, either reuse or replace
  const existing = loadState();
  if (existing && isProcessAlive(existing.pid)) {
    if (existing.cwd && existing.cwd !== serverCwd) {
      // Existing instance is in a different directory — kill it and start fresh
      console.log(`\nExisting squid-chat is running in a different directory:`);
      console.log(`  Old: ${existing.cwd}`);
      console.log(`  New: ${serverCwd}`);
      console.log("  Stopping old instance...");
      try {
        process.kill(existing.pid, "SIGTERM");
      } catch { /* already gone */ }
      // Wait for the OpenCode port to be released before proceeding
      await waitForPortFree(opencodePort, opencodeHost, 8000);
    } else {
      // Same directory (or existing.cwd missing on older state) — just reopen
      console.log(`\u2713 squid-chat already running at ${existing.url}`);
      try {
        execSync(`open "${existing.url}"`, { stdio: "ignore" });
      } catch {}
      return;
    }
  }

  clearState();

  const manifest = new ManifestManager();
  if (!manifest.isInstalled()) {
    console.log("squid-chat is not installed. Run `squid-chat install` first.");
    process.exit(1);
  }

  const opencodeUrl = `http://${opencodeHost}:${opencodePort}`;

  // Check if OpenCode port is available
  const portAvailable = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(opencodePort, opencodeHost);
  });

  let opencodeServer: { url: string; close: () => void } | null = null;
  let opencodeAbortController: AbortController | undefined;

  if (portAvailable) {
    if (!existsSync(OPENCODE_BIN)) {
      console.log("  Downloading OpenCode binary...");
      await ensureOpencodeBinary();
    } else {
      // Verify binary is executable
      try {
        accessSync(OPENCODE_BIN, constants.X_OK);
      } catch {
        console.log("  OpenCode binary not executable, re-downloading...");
        await ensureOpencodeBinary({ forceUpgrade: true });
      }
    }

    // Switch to the target working directory before launching OpenCode
    // The SDK's createOpencodeServer spawns 'opencode serve' which inherits
    // this process's CWD, so we must chdir for it to pick up the right project
    try {
      process.chdir(serverCwd);
    } catch (err) {
      console.error(`  Failed to change to directory: ${serverCwd}`, err instanceof Error ? err.message : err);
      process.exit(1);
    }

    opencodeAbortController = new AbortController();

    console.log("  Starting OpenCode server...");
    opencodeServer = await createOpencodeServer({
      hostname: opencodeHost,
      port: opencodePort,
      signal: opencodeAbortController.signal,
    });
  } else {
    console.log("  Using existing OpenCode server...");
  }

  const activeOpencodeUrl = opencodeServer?.url ?? opencodeUrl;

  console.log("  Starting UI server...");
  const uiDir = UI_DIR;
  const { port: uiPort, serverProcess } = await startUIServer(uiDir, activeOpencodeUrl, previousUIPort);

  const uiUrl = `http://127.0.0.1:${uiPort}`;

  console.log("  Verifying health...");
  const healthy = await healthCheck(uiUrl, activeOpencodeUrl);
  if (!healthy) {
    console.error("  Health check failed");
    opencodeServer?.close();
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
    opencodeAbortController?.abort();
    opencodeServer?.close();
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
