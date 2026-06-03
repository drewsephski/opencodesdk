import { homedir, platform, arch } from "os";
import { join } from "path";

const BASE = join(homedir(), ".squid-chat");

export const SQUID_CHAT_DIR = BASE;
export const BIN_DIR = join(BASE, "bin");
export const OPENCODE_BIN = join(BIN_DIR, "opencode");
export const UI_DIR = join(BASE, "ui");
export const CONFIG_PATH = join(BASE, "config.json");
export const MANIFEST_PATH = join(BASE, "manifest.json");
export const STATE_PATH = join(BASE, "run", "state.json");
export const LOCK_PATH = join(BASE, "run", "lock");
export const WORKSPACES_DIR = join(BASE, "workspaces");

export function getPlatformTarget(): string {
  const p = platform();
  const a = arch();
  if (p === "darwin" && a === "arm64") return "mac-arm64";
  if (p === "darwin" && a === "x64") return "mac-x86_64";
  if (p === "linux" && a === "x64") return "linux-x86_64";
  if (p === "linux" && a === "arm64") return "linux-arm64";
  throw new Error(`Unsupported platform: ${p} ${a}`);
}
