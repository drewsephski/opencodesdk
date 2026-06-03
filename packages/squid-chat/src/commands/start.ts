import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync, createWriteStream } from "fs";
import { dirname } from "path";
import { createOpencodeServer } from "@opencode-ai/sdk";
import { loadConfig } from "../config.js";
import { loadState, saveState, clearState, isProcessAlive } from "../state.js";
import { OPENCODE_BIN, UI_DIR, BIN_DIR } from "../paths.js";
import { ensureOpencodeBinary } from "../download.js";
import { ensureUIBundle } from "../download.js";
import { healthCheck } from "../health.js";
import { detectProject } from "../project.js";
import { ManifestManager } from "../manifest.js";

export async function startCommand(): Promise<void> {
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

  if (!existsSync(OPENCODE_BIN)) {
    console.log("  Downloading OpenCode binary...");
    await ensureOpencodeBinary();
  }

  console.log("  Starting OpenCode server...");
  const opencodeServer = await createOpencodeServer({
    hostname: config.opencodeHostname,
    port: config.opencodePort,
  });
  const opencodeUrl = opencodeServer.url;

  console.log("  Starting UI server...");
  const uiDir = UI_DIR;
  const { port: uiPort, serverProcess } = await startUIServer(uiDir, opencodeUrl);

  const uiUrl = `http://127.0.0.1:${uiPort}`;

  console.log("  Verifying health...");
  const healthy = await healthCheck(uiUrl, opencodeUrl);
  if (!healthy) {
    console.error("  Health check failed");
    opencodeServer.close();
    serverProcess?.kill();
    process.exit(1);
  }

  const project = await detectProject();
  if (project) {
    console.log(`  Project detected: ${project.name} (${project.framework})`);
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

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    opencodeServer.close();
    serverProcess?.kill();
    clearState();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    opencodeServer.close();
    serverProcess?.kill();
    clearState();
    process.exit(0);
  });

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
