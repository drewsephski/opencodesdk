import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { dirname } from "path";
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

  const res = await fetch(asset.browser_download_url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = parseInt(res.headers.get("content-length") ?? "0", 10);
  const reader = res.body!.getReader();
  const writer = createWriteStream(tmpDest);
  let downloaded = 0;
  let lastProgress = "";

  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(value);
      downloaded += value.length;
      if (total > 0) {
        const pct = Math.round((downloaded / total) * 100);
        const msg = `    [${pct}%] ${formatBytes(downloaded)} / ${formatBytes(total)}\r`;
        if (msg !== lastProgress) { lastProgress = msg; process.stderr.write(msg); }
      }
    }
    writer.close();
  };
  await pump();

  execSync(`tar -xzf "${tmpDest}" -C "${BIN_DIR}"`, { stdio: "ignore" });
  if (!existsSync(OPENCODE_BIN)) throw new Error("Extraction succeeded but opencode binary not found");
  chmodSync(OPENCODE_BIN, 0o755);
  return version;
}

export async function ensureUIBundle(options?: DownloadOptions): Promise<string> {
  const manifestPath = `${UI_DIR}/version.json`;
  if (existsSync(manifestPath) && !options?.forceUpgrade) {
    try {
      return JSON.parse(readFileSync(manifestPath, "utf-8")).version;
    } catch { /* fall through to download */ }
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

  const res = await fetch(asset.browser_download_url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = parseInt(res.headers.get("content-length") ?? "0", 10);
  const reader = res.body!.getReader();
  const writer = createWriteStream(tmpDest);
  let downloaded = 0;
  let lastProgress = "";

  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(value);
      downloaded += value.length;
      if (total > 0) {
        const pct = Math.round((downloaded / total) * 100);
        const msg = `    [${pct}%] ${formatBytes(downloaded)} / ${formatBytes(total)}\r`;
        if (msg !== lastProgress) { lastProgress = msg; process.stderr.write(msg); }
      }
    }
    writer.close();
  };
  await pump();

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

  execSync(`tar -xzf "${tmpDest}" -C "${UI_DIR}"`, { stdio: "ignore" });
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
