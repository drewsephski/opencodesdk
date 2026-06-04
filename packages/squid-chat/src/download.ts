import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { dirname } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { BIN_DIR, OPENCODE_BIN, UI_DIR, getPlatformTarget } from "./paths.js";

const OPENCODE_RELEASES = "https://api.github.com/repos/opencode-ai/opencode/releases/latest";
const GITHUB_RELEASES = "https://api.github.com/repos/drewsephski/opencodesdk/releases";

interface DownloadOptions {
  forceUpgrade?: boolean;
  onProgress?: (downloaded: number, total: number) => void;
}

const UA = "squid-chat/0.1.0";

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json() as Promise<Record<string, unknown>>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Download a file using native fetch() and stream it to disk.
 * Cross-platform replacement for `curl -o`.
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  if (!res.body) throw new Error(`No response body from ${url}`);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(dest));
}

/**
 * Extract a .tar.gz archive to a directory.
 * Uses shell-based `gunzip | tar` which is available on macOS and Linux.
 * The download step (curl → native fetch) is the more impactful cross-platform fix.
 */
function extractTarGz(archivePath: string, destDir: string): void {
  execSync(`gunzip -c "${archivePath}" | tar -xf - -C "${destDir}"`, { stdio: "ignore", timeout: 30_000 });
}

export async function ensureOpencodeBinary(options?: DownloadOptions): Promise<string> {
  if (existsSync(OPENCODE_BIN) && !options?.forceUpgrade) {
    return getCurrentVersion(OPENCODE_BIN);
  }

  const target = getPlatformTarget();
  if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });

  const release = (await fetchJson(OPENCODE_RELEASES)) as {
    tag_name: string; assets: Array<{ name: string; browser_download_url: string }>;
  };
  const version = release.tag_name.replace(/^v/, "");

  const archiveName = `opencode-${target}.tar.gz`;
  const asset = release.assets.find((a) => a.name === archiveName);
  if (!asset) {
    throw new Error(`No OpenCode binary found for ${target} in release ${release.tag_name}`);
  }

  console.log(`    Downloading OpenCode ${version} (${target})...`);
  const tmpDest = `${BIN_DIR}/opencode.tar.gz`;

  await downloadFile(asset.browser_download_url, tmpDest);
  extractTarGz(tmpDest, BIN_DIR);

  if (!existsSync(OPENCODE_BIN)) throw new Error("Extraction succeeded but opencode binary not found");
  chmodSync(OPENCODE_BIN, 0o755);
  return version;
}

export async function ensureUIBundle(options?: DownloadOptions): Promise<string> {
  const manifestPath = `${UI_DIR}/version.json`;
  if (existsSync(manifestPath) && !options?.forceUpgrade) {
    try {
      return JSON.parse(readFileSync(manifestPath, "utf-8")).version;
    } catch (e) {
      console.warn(`Warning: corrupted UI version manifest at ${manifestPath}, re-downloading — ${(e as Error).message}`);
    }
  }

  if (!existsSync(UI_DIR)) mkdirSync(UI_DIR, { recursive: true });

  const release = (await fetchJson(`${GITHUB_RELEASES}/latest`)) as {
    tag_name: string; assets: Array<{ name: string; browser_download_url: string }>;
  };
  const version = release.tag_name.replace(/^v/, "");

  const asset = release.assets.find(
    (a) => a.name.startsWith("squid-chat-ui-") && a.name.endsWith(".tar.gz"),
  );
  if (!asset) throw new Error(`No UI bundle found in release ${release.tag_name}`);

  const checksumAsset = release.assets.find((a) => a.name === `${asset.name}.sha256`);

  console.log(`    Downloading UI bundle ${version}...`);
  const tmpDest = `${UI_DIR}/bundle.tar.gz`;

  await downloadFile(asset.browser_download_url, tmpDest);

  if (checksumAsset) {
    const checksumRes = await fetch(checksumAsset.browser_download_url, { headers: { "User-Agent": UA } });
    const expectedChecksum = (await checksumRes.text()).trim().split(/\s+/)[0];
    const hash = createHash("sha256");
    hash.update(readFileSync(tmpDest));
    const actual = hash.digest("hex");
    if (actual !== expectedChecksum) {
      throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${actual}`);
    }
    console.log("    \u2713 Checksum verified");
  }

  extractTarGz(tmpDest, UI_DIR);
  writeFileSync(`${UI_DIR}/version.json`, JSON.stringify({ version }));
  return version;
}

function getCurrentVersion(binaryPath: string): string {
  try {
    const output = execSync(`"${binaryPath}" --version 2>/dev/null || echo "?"`).toString().trim();
    return output || "?";
  } catch {
    return "?";
  }
}
