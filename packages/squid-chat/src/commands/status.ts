import { loadState, isProcessAlive } from "../state.js";
import { healthCheck } from "../health.js";
import { ManifestManager } from "../manifest.js";

export async function statusCommand(): Promise<void> {
  const manifest = new ManifestManager();

  console.log(`squid-chat`);
  console.log(`  CLI:     ${manifest.get("cliVersion") || "?"}`);
  console.log(`  UI:      ${manifest.get("uiVersion") || "?"}`);
  console.log(`  OpenCode: ${manifest.get("opencodeVersion") || "?"}`);
  console.log(`  Channel: ${manifest.get("channel") || "stable"}`);

  const state = loadState();
  if (!state) {
    console.log("\n\u2717 Not running");
    return;
  }

  if (!isProcessAlive(state.pid)) {
    console.log(`\n\u2717 Process ${state.pid} is dead (stale state)`);
    return;
  }

  console.log(`\n  PID:     ${state.pid}`);
  console.log(`  URL:     ${state.url}`);
  console.log(`  Started: ${new Date(state.startedAt).toISOString()}`);

  const healthy = await healthCheck(state.url);
  if (healthy) {
    console.log("\n\u2713 All systems healthy");
  } else {
    console.log("\n\u2717 Health check failed");
  }
}
