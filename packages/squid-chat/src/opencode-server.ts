/**
 * Spawns the `opencode serve` binary with an explicit working directory.
 *
 * The SDK's `createOpencodeServer` has no `cwd` option, so it relies on the
 * calling process mutating global state via `process.chdir()`.  This module
 * wraps `child_process.spawn` directly so the OpenCode child process always
 * starts in the exact directory we intend — no shared-state side effects.
 */

import { spawn } from "child_process";
import { OPENCODE_BIN } from "./paths.js";

export interface OpencodeServerOptions {
  hostname: string;
  port: number;

  /** Explicit working directory for the `opencode serve` process. */
  cwd: string;

  /** AbortSignal to stop the server (e.g. on SIGINT/SIGTERM). */
  signal?: AbortSignal;

  /** Milliseconds to wait for the server to be ready (default: 5000). */
  timeout?: number;
}

export interface OpencodeServer {
  /** Base URL of the running server (e.g. http://127.0.0.1:4096). */
  url: string;

  /** Gracefully stop the server. */
  close(): void;
}

// ---------------------------------------------------------------------------
// Process helpers (duplicated from SDK internals to avoid a dependency cycle)
// ---------------------------------------------------------------------------

function stop(proc: ReturnType<typeof spawn>): void {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  if (process.platform === "win32" && proc.pid) {
    try {
      const { spawnSync } = require("child_process") as typeof import("child_process");
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true });
      return;
    } catch {
      // fall through to proc.kill()
    }
  }
  proc.kill();
}

function bindAbort(
  proc: ReturnType<typeof spawn>,
  signal: AbortSignal | undefined,
  onAbort?: () => void,
): () => void {
  if (!signal) return () => {};
  const abort = () => {
    clear();
    stop(proc);
    onAbort?.();
  };
  const clear = () => {
    signal.removeEventListener("abort", abort);
    proc.off("exit", clear);
    proc.off("error", clear);
  };
  signal.addEventListener("abort", abort, { once: true });
  proc.on("exit", clear);
  proc.on("error", clear);
  if (signal.aborted) abort();
  return clear;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startOpencodeServer(
  options: OpencodeServerOptions,
): Promise<OpencodeServer> {
  const { hostname, port, cwd, signal, timeout = 5000 } = options;

  const args = [`serve`, `--hostname=${hostname}`, `--port=${port}`];

  const proc = spawn(OPENCODE_BIN, args, {
    /** ── THE KEY FIX ── explicit working directory, no process.chdir() needed */
    cwd,
    env: {
      ...process.env,
      // Same env-config the SDK passes; empty object matches "no config" default.
      OPENCODE_CONFIG_CONTENT: JSON.stringify({}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let clear = () => {};
  const url = await new Promise<string>((resolve, reject) => {
    const id = setTimeout(() => {
      clear();
      stop(proc);
      reject(new Error(`Timeout waiting for server to start after ${timeout}ms`));
    }, timeout);

    let output = "";
    let resolved = false;

    proc.stdout?.on("data", (chunk: Buffer) => {
      if (resolved) return;
      output += chunk.toString();
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.startsWith("opencode server listening")) {
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
          if (!match) {
            clear();
            stop(proc);
            clearTimeout(id);
            reject(new Error(`Failed to parse server url from output: ${line}`));
            return;
          }
          clearTimeout(id);
          resolved = true;
          resolve(match[1]);
          return;
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.on("exit", (code) => {
      clearTimeout(id);
      let msg = `Server exited with code ${code}`;
      if (output.trim()) msg += `\nServer output: ${output}`;
      reject(new Error(msg));
    });

    proc.on("error", (error) => {
      clearTimeout(id);
      reject(error);
    });

    clear = bindAbort(proc, signal, () => {
      clearTimeout(id);
      reject(signal?.reason ?? new Error("Aborted"));
    });
  });

  return {
    url,
    close() {
      clear();
      stop(proc);
    },
  };
}
