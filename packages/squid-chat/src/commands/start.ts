import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { createServer } from "net";
import { createOpencodeServer } from "@opencode-ai/sdk";
import { loadConfig } from "../config.js";
import { loadState, saveState, clearState, isProcessAlive, type RuntimeState } from "../state.js";
import { OPENCODE_BIN, UI_DIR, RESTART_MARKER_PATH } from "../paths.js";
import { ensureOpencodeBinary } from "../download.js";
import { healthCheck } from "../health.js";
import { detectProject } from "../project.js";
import { ManifestManager } from "../manifest.js";
import { WorkspaceManager } from "../workspace.js";

export async function startCommand(cwd?: string, previousUIPort?: number): Promise<void> {
  const config = loadConfig();

  const existing = loadState();
  if (existing && isProcessAlive(existing.pid)) {
    console.log(`\u2713 squid-chat already running at ${existing.url}`);
    try {
      execSync(`open "${existing.url}"`, { stdio: "ignore" });
    } catch {}
    return;
  }

  clearState();

  const manifest = new ManifestManager();
  if (!manifest.isInstalled()) {
    console.log("squid-chat is not installed. Run `squid-chat install` first.");
    process.exit(1);
  }

  const opencodeHost = config.opencodeHostname;
  const opencodePort = config.opencodePort;
  const opencodeUrl = `http://${opencodeHost}:${opencodePort}`;

  // Check if OpenCode port is available
  const portAvailable = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => { server.close(); resolve(true); });
    server.listen(opencodePort, opencodeHost);
  });

  let opencodeServer: { url: string; close: () => void } | null = null;
  let opencodeStarted = false;

  if (portAvailable) {
    if (!existsSync(OPENCODE_BIN)) {
      console.log("  Downloading OpenCode binary...");
      await ensureOpencodeBinary();
    }
    const serverCwd = cwd ?? process.cwd();
    process.chdir(serverCwd);
    console.log("  Starting OpenCode server...");
    opencodeServer = await createOpencodeServer({
      hostname: opencodeHost,
      port: opencodePort,
    });
    opencodeStarted = true;
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
  const project = await detectProject(cwd);
  const wm = new WorkspaceManager();
  if (project) {
    console.log(`  Project detected: ${project.name} (${project.framework})`);
    const existingWs = wm.findByPath(process.cwd());
    if (!existingWs) {
      wm.add({
        path: process.cwd(),
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

    if (!marker.cwd || marker.cwd === process.cwd()) return;

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
