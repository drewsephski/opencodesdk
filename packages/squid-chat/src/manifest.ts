import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { MANIFEST_PATH } from "./paths.js";

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
  cliVersion: "0.1.0",
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
    } catch {
      this.data = { ...DEFAULT_MANIFEST };
    }
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
