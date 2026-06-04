import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { dirname } from "path";
import { STATE_PATH, LOCK_PATH } from "./paths.js";

export interface RuntimeState {
  pid: number;
  url: string;
  startedAt: number;
  cwd?: string;
  opencodePid?: number;
  uiPort?: number;
}

export function loadState(): RuntimeState | null {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    }
  } catch (e) {
    console.warn(`Warning: corrupted state at ${STATE_PATH}, ignoring — ${(e as Error).message}`);
  }
  return null;
}

export function saveState(state: RuntimeState): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  writeFileSync(LOCK_PATH, String(state.pid));
}

export function clearState(): void {
  try { if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH); } catch {}
  try { if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH); } catch {}
}

export function isProcessAlive(pid: number): boolean {
  try {
    return process.kill(pid, 0);
  } catch {
    return false;
  }
}
