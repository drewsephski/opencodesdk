import { ensureOpencodeBinary, ensureUIBundle } from "../download.js";
import { ManifestManager } from "../manifest.js";

export async function installCommand(): Promise<void> {
  const manifest = new ManifestManager();

  console.log("Installing squid-chat...\n");

  console.log("1/2 Downloading OpenCode binary...");
  const opencodeVersion = await ensureOpencodeBinary();
  manifest.set("opencodeVersion", opencodeVersion);

  console.log("2/2 Downloading UI bundle...");
  const uiVersion = await ensureUIBundle();
  manifest.set("uiVersion", uiVersion);

  manifest.set("installed", true);
  manifest.set("installedAt", new Date().toISOString());
  manifest.save();

  console.log(`\n\u2713 squid-chat installed successfully`);
  console.log("  Run `squid-chat` to start.");
}
