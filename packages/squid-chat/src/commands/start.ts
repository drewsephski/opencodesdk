import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
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

export async function startCommand(cwd?: string): Promise<void> {
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

  const opencodeUrl = `http://${config.opencodeHostname}:${config.opencodePort}`;

  const portAvailable = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => { server.close(); resolve(true); });
    server.listen(config.opencodePort, config.opencodeHostname);
  });

  let opencodeServer: { url: string; close: () => void } | null = null;

  if (portAvailable) {
    if (!existsSync(OPENCODE_BIN)) {
      console.log("  Downloading OpenCode binary...");
      await ensureOpencodeBinary();
    }
    // Switch to workspace CWD before starting the server so it detects the right project
    const serverCwd = cwd ?? process.cwd();
    process.chdir(serverCwd);
    console.log("  Starting OpenCode server...");
    opencodeServer = await createOpencodeServer({
      hostname: config.opencodeHostname,
      port: config.opencodePort,
    });
  } else {
    console.log("  Using existing OpenCode server...");
  }

  const activeOpencodeUrl = opencodeServer?.url ?? opencodeUrl;

  console.log("  Starting UI server...");
  const uiDir = UI_DIR;
  const { port: uiPort, serverProcess } = await startUIServer(uiDir, activeOpencodeUrl);

  const uiUrl = `http://127.0.0.1:${uiPort}`;

  console.log("  Verifying health...");
  const healthy = await healthCheck(uiUrl, activeOpencodeUrl);
  if (!healthy) {
    console.error("  Health check failed");
    opencodeServer?.close();
    serverProcess?.kill();
    process.exit(1);
  }

  const project = await detectProject(cwd);
  const wm = new WorkspaceManager();
  if (project) {
    console.log(`  Project detected: ${project.name} (${project.framework})`);
    const existing = wm.findByPath(process.cwd());
    if (!existing) {
      wm.add({
        path: process.cwd(),
        name: project.name,
        projectName: project.name,
        framework: project.framework,
        language: project.language,
      });
      console.log(`  Added workspace: ${project.name}`);
    } else {
      wm.touch(existing.id);
    }
  }

  saveState({
    pid: process.pid,
    url: uiUrl,
    startedAt: Date.now(),
  });

  console.log(`\n\u2713 squid-chat running at ${uiUrl}`);
  try {
    execSync(`open "${uiUrl}"`, { stdio: "ignore" });
  } catch {}

  function shutdown() {
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
  const checkInterval = setInterval(() => {
    if (!existsSync(RESTART_MARKER_PATH)) return;
    try {
      const marker = JSON.parse(readFileSync(RESTART_MARKER_PATH, "utf-8"));
      if (marker.cwd && marker.cwd !== process.cwd()) {
        clearInterval(checkInterval);
        console.log(`\nSwitching to workspace: ${marker.cwd}`);
        unlinkSync(RESTART_MARKER_PATH);
        shutdown();
        // Start again with the new CWD — reuse same process
        startCommand(marker.cwd);
      }
    } catch {
      // Malformed or race — ignore
    }
  }, 2000);

  await new Promise(() => {});
}

async function startUIServer(
  uiDir: string,
  opencodeUrl: string,
): Promise<{ port: number; serverProcess?: import("child_process").ChildProcess }> {
  const serverJs = `${uiDir}/server.js`;
  if (!existsSync(serverJs)) {
    throw new Error(`UI not found at ${uiDir}. Run \`squid-chat install\` first.`);
  }

  const child = spawn("node", ["server.js"], {
    cwd: uiDir,
    env: {
      ...process.env,
      PORT: "0",
      HOSTNAME: "127.0.0.1",
      OPENCODE_SERVER_URL: opencodeUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const port = await new Promise<number>((resolve, reject) => {
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

  return { port, serverProcess: child };
}
