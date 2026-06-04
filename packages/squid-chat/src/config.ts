import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { CONFIG_PATH } from "./paths.js";

export interface Config {
  port: number;
  theme: "system" | "light" | "dark";
  opencodeHostname: string;
  opencodePort: number;
  model: string;
  autoUpgrade: boolean;
  projectDetection: boolean;
  telemetry: boolean;
}

const DEFAULTS: Config = {
  port: 0,
  theme: "system",
  opencodeHostname: "127.0.0.1",
  opencodePort: 4096,
  model: "opencode/big-pickle",
  autoUpgrade: false,
  projectDetection: true,
  telemetry: false,
};

export function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn(`Warning: corrupted config at ${CONFIG_PATH}, using defaults — ${(e as Error).message}`);
  }
  return { ...DEFAULTS };
}

export function saveConfig(config: Config): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
