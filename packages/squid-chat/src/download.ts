import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { get } from "https";
import { dirname } from "path";
import { BIN_DIR, OPENCODE_BIN, UI_DIR, getPlatformTarget } from "./paths.js";

const OPENCODE_RELEASES = "https://api.github.com/repos/opencode-ai/opencode/releases/latest";
const GITHUB_RELEASES = "https://api.github.com/repos/drewsephski/opencodesdk/releases";

interface DownloadOptions {
  forceUpgrade?: boolean;
  onProgress?: (downloaded: number, total: number) => void;
}

function httpGet(url: string): Promise<{ statusCode: number; data: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": "squid-chat/0.1.0", Accept: "application/json" } }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 500, data, headers: res.headers as Record<string, string> }));
    }).on("error", reject);
  });
}

function downloadFile(url: string, dest: string, options?: DownloadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = dirname(dest);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    get(url, { headers: { "User-Agent": "squid-chat/0.1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] ?? "0", 10);
      let downloaded = 0;
      const file = createWriteStream(dest);
      res.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        options?.onProgress?.(downloaded, total);
      });
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    }).on("error", reject);
  });
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

  const releaseInfo = await httpGet(OPENCODE_RELEASES);
  const release = JSON.parse(releaseInfo.data);
  const version = (release.tag_name as string).replace(/^v/, "");

  const archiveName = `opencode-${target}.tar.gz`;
  const asset = (release.assets as Array<{ name: string; browser_download_url: string }>)
    .find((a) => a.name === archiveName);

  if (!asset) {
    throw new Error(`No OpenCode binary found for ${target} in release ${release.tag_name}`);
  }

  console.log(`    Downloading OpenCode ${version} (${target})...`);

  const tmpDest = `${BIN_DIR}/opencode.tar.gz`;
  let lastProgress = "";
  await downloadFile(asset.browser_download_url, tmpDest, {
    ...options,
    onProgress: (downloaded, total) => {
      if (total > 0) {
        const pct = Math.round((downloaded / total) * 100);
        const msg = `    [${pct}%] ${formatBytes(downloaded)} / ${formatBytes(total)}\r`;
        if (msg !== lastProgress) { lastProgress = msg; process.stderr.write(msg); }
      }
    },
  });

  execSync(`tar -xzf "${tmpDest}" -C "${BIN_DIR}"`, { stdio: "ignore" });
  if (!existsSync(OPENCODE_BIN)) {
    throw new Error("Extraction succeeded but opencode binary not found");
  }
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

  const releaseInfo = await httpGet(`${GITHUB_RELEASES}/latest`);
  const release = JSON.parse(releaseInfo.data);
  const version = (release.tag_name as string).replace(/^v/, "");

  const asset = (release.assets as Array<{ name: string; browser_download_url: string }>)
    .find((a) => a.name.startsWith("squid-chat-ui-") && a.name.endsWith(".tar.gz"));

  if (!asset) {
    throw new Error(`No UI bundle found in release ${release.tag_name}`);
  }

  const assetChecksum = (release.assets as Array<{ name: string; browser_download_url: string }>)
    .find((a) => a.name === `${asset.name}.sha256`);

  console.log(`    Downloading UI bundle ${version}...`);
  const tmpDest = `${UI_DIR}/bundle.tar.gz`;
  await downloadFile(asset.browser_download_url, tmpDest, options);

  if (assetChecksum) {
    const { data: expectedChecksum } = await httpGet(assetChecksum.browser_download_url);
    const hash = createHash("sha256");
    hash.update(readFileSync(tmpDest));
    const actual = hash.digest("hex");
    const expected = expectedChecksum.trim().split(/\s+/)[0];
    if (actual !== expected) {
      throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
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
