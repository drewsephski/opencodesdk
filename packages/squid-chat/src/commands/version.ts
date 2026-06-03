import { ManifestManager } from "../manifest.js";

export async function versionCommand(): Promise<void> {
  const manifest = new ManifestManager();

  console.log(`squid-chat v${manifest.get("cliVersion") || "?"}`);
  console.log(`  UI bundle:      ${manifest.get("uiVersion") || "not installed"}`);
  console.log(`  OpenCode binary: ${manifest.get("opencodeVersion") || "not installed"}`);
}
