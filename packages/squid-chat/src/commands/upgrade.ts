import { ManifestManager } from "../manifest.js";
import { ensureUIBundle, ensureOpencodeBinary } from "../download.js";

export async function upgradeCommand(): Promise<void> {
  const manifest = new ManifestManager();

  console.log("Checking for updates...\n");

  let upgraded = false;

  try {
    console.log("  Checking OpenCode binary...");
    const newVersion = await ensureOpencodeBinary({ forceUpgrade: true });
    if (newVersion !== manifest.get("opencodeVersion")) {
      manifest.set("opencodeVersion", newVersion);
      console.log("    \u2713 Updated");
      upgraded = true;
    } else {
      console.log("    Already up to date");
    }
  } catch (err) {
    console.error("    Failed:", err instanceof Error ? err.message : err);
  }

  try {
    console.log("  Checking UI bundle...");
    const newVersion = await ensureUIBundle({ forceUpgrade: true });
    if (newVersion !== manifest.get("uiVersion")) {
      manifest.set("uiVersion", newVersion);
      console.log("    \u2713 Updated");
      upgraded = true;
    } else {
      console.log("    Already up to date");
    }
  } catch (err) {
    console.error("    Failed:", err instanceof Error ? err.message : err);
  }

  if (upgraded) {
    manifest.save();
    console.log("\n\u2713 Upgrade complete");
  } else {
    console.log("\n\u2713 All components up to date");
  }
}
