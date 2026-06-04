import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { MANIFEST_PATH } from "./paths.js";

/**
 * Read the CLI's own package.json to extract the current version.
 * Uses createRequire for robust resolution across packaging tools
 * (tsc, esbuild, ncc, pkg) instead of a fragile __dirname-relative path.
 */
const _require = createRequire(import.meta.url);
let pkg: { version: string };
try {
  pkg = _require("../package.json");
} catch {
  // Fallback: if bundled/packaged, try __dirname-relative
  const __dirname = dirname(fileURLToPath(import.meta.url));
  pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
}

interface Manifest {
  installed: boolean;
  installedAt: string;
  channel: string;
  cliVersion: string;
  uiVersion: string;
  opencodeVersion: string;
}

const DEFAULT_MANIFEST: Manifest = {
  installed: false,
  installedAt: "",
  channel: "stable",
  cliVersion: pkg.version,
  uiVersion: "",
  opencodeVersion: "",
};

export class ManifestManager {
  private data: Manifest;

  constructor() {
    try {
      if (existsSync(MANIFEST_PATH)) {
        this.data = { ...DEFAULT_MANIFEST, ...JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) };
      } else {
        this.data = { ...DEFAULT_MANIFEST };
      }
    } catch (e) {
      console.warn(`Warning: corrupted manifest at ${MANIFEST_PATH}, resetting — ${(e as Error).message}`);
      this.data = { ...DEFAULT_MANIFEST };
    }
    // Always use the runtime version — don't let a stale cache override it
    this.data.cliVersion = pkg.version;
  }

  isInstalled(): boolean {
    return this.data.installed;
  }

  get<K extends keyof Manifest>(key: K): Manifest[K] {
    return this.data[key];
  }

  set<K extends keyof Manifest>(key: K, value: Manifest[K]): void {
    this.data[key] = value;
  }

  save(): void {
    const dir = dirname(MANIFEST_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(MANIFEST_PATH, JSON.stringify(this.data, null, 2));
  }
}
