#!/usr/bin/env node
import { existsSync } from "fs";
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { statusCommand } from "./commands/status.js";
import { installCommand } from "./commands/install.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { versionCommand } from "./commands/version.js";
import { SQUID_CHAT_DIR } from "./paths.js";
import { ManifestManager } from "./manifest.js";

const USAGE = `squid-chat — A beautiful chat UI for OpenCode SDK

Usage:
  squid-chat                    Install if needed, then start
  squid-chat start              Start squid-chat
  squid-chat stop               Stop squid-chat
  squid-chat status             Show running status
  squid-chat install            Download binary + UI bundle
  squid-chat upgrade            Upgrade components
  squid-chat version            Show versions
  squid-chat --help             Show this help
`;

function isInstalled(): boolean {
  return new ManifestManager().isInstalled();
}

async function main() {
  const cmd = process.argv[2]?.toLowerCase();

  if (!cmd || cmd === "start" || cmd === "--help" || cmd === "-h") {
    if (cmd === "--help" || cmd === "-h") {
      console.log(USAGE);
      return;
    }

    if (!isInstalled()) {
      console.log("squid-chat is not installed. Installing...\n");
      await installCommand();
    }

    await startCommand();
    return;
  }

  switch (cmd) {
    case "stop":
      await stopCommand();
      break;
    case "status":
      await statusCommand();
      break;
    case "install":
      await installCommand();
      break;
    case "upgrade":
      await upgradeCommand();
      break;
    case "version":
    case "--version":
    case "-v":
      await versionCommand();
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
