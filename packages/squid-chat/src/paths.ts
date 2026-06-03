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
  if (p === "darwin" && a === "arm64") return "aarch64-apple-darwin";
  if (p === "darwin" && a === "x64") return "x86_64-apple-darwin";
  if (p === "linux" && a === "x64") return "x86_64-unknown-linux-gnu";
  if (p === "linux" && a === "arm64") return "aarch64-unknown-linux-gnu";
  throw new Error(`Unsupported platform: ${p} ${a}`);
}
