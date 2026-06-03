import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface ProjectInfo {
  name: string;
  framework: string;
  language: string;
  packageManager: string;
}

interface ProjectDetector {
  name: string;
  detect(path: string): ProjectInfo | null;
}

const detectors: ProjectDetector[] = [
  {
    name: "Next.js",
    detect(path: string): ProjectInfo | null {
      try {
        const pkg = JSON.parse(readFileSync(join(path, "package.json"), "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.next) {
          return {
            name: pkg.name || path.split("/").pop() || "project",
            framework: `Next.js ${deps.next}`,
            language: deps.typescript ? "TypeScript" : "JavaScript",
            packageManager: detectPackageManager(path),
          };
        }
      } catch {}
      return null;
    },
  },
  {
    name: "Vite",
    detect(path: string): ProjectInfo | null {
      try {
        const pkg = JSON.parse(readFileSync(join(path, "package.json"), "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.vite) {
          return {
            name: pkg.name || path.split("/").pop() || "project",
            framework: "Vite",
            language: deps.typescript ? "TypeScript" : "JavaScript",
            packageManager: detectPackageManager(path),
          };
        }
      } catch {}
      return null;
    },
  },
  {
    name: "Node.js",
    detect(path: string): ProjectInfo | null {
      try {
        const pkg = JSON.parse(readFileSync(join(path, "package.json"), "utf-8"));
        return {
          name: pkg.name || path.split("/").pop() || "project",
          framework: "Node.js",
          language: pkg.devDependencies?.typescript ? "TypeScript" : "JavaScript",
          packageManager: detectPackageManager(path),
        };
      } catch {}
      return null;
    },
  },
];

function detectPackageManager(path: string): string {
  if (existsSync(join(path, "bun.lock")) || existsSync(join(path, "bun.lockb"))) return "bun";
  if (existsSync(join(path, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(path, "yarn.lock"))) return "yarn";
  if (existsSync(join(path, "package-lock.json"))) return "npm";
  return "unknown";
}

export async function detectProject(cwd?: string): Promise<ProjectInfo | null> {
  const dir = cwd || process.cwd();
  for (const detector of detectors) {
    const result = detector.detect(dir);
    if (result) return result;
  }
  return null;
}
