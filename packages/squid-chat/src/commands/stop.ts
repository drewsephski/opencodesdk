import { loadState, clearState, isProcessAlive } from "../state.js";

export async function stopCommand(): Promise<void> {
  const state = loadState();
  if (!state) {
    console.log("squid-chat is not running.");
    return;
  }

  if (isProcessAlive(state.pid)) {
    try {
      process.kill(state.pid, "SIGTERM");
    } catch {}
    console.log("\u2713 squid-chat stopped");
  } else {
    console.log("squid-chat was not running (stale state cleaned up)");
  }

  clearState();
}
