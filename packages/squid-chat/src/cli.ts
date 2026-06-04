#!/usr/bin/env node
import { existsSync } from "fs";
import { resolve } from "path";
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { statusCommand } from "./commands/status.js";
import { installCommand } from "./commands/install.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { versionCommand } from "./commands/version.js";
import { workspaceCommand } from "./commands/workspace.js";
import { SQUID_CHAT_DIR } from "./paths.js";
import { ManifestManager } from "./manifest.js";

const USAGE = `squid-chat — A beautiful chat UI for OpenCode SDK

Usage:
  squid-chat                    Install if needed, then start
  squid-chat start [--dir <path>]   Start squid-chat (optionally in a specific directory)
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

/**
 * Extract the --dir / --cwd value from argv, resolving to an absolute path.
 * Also supports a positional path argument after `start`:
 *   squid-chat start --dir /path
 *   squid-chat start --cwd /path
 *   squid-chat start /path
 */
function resolveTargetDir(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--dir" || argv[i] === "--cwd") && i + 1 < argv.length) {
      return resolve(argv[i + 1]);
    }
  }
  return undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0]?.toLowerCase();

  if (!cmd || cmd === "start" || cmd === "--help" || cmd === "-h") {
    if (cmd === "--help" || cmd === "-h") {
      console.log(USAGE);
      return;
    }

    let targetDir = resolveTargetDir(argv);

    // Positional path after `start` subcommand: squid-chat start /some/dir
    if (!targetDir && cmd === "start" && argv[1] && !argv[1].startsWith("-")) {
      targetDir = resolve(argv[1]);
    }

    if (!isInstalled()) {
      console.log("squid-chat is not installed. Installing...\n");
      await installCommand();
    }

    await startCommand(targetDir);
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
    case "workspace":
      await workspaceCommand(process.argv.slice(3));
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
