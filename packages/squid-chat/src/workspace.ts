import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { WORKSPACES_PATH } from "./paths.js";

export interface WorkspaceEntry {
  id: string;
  path: string;
  name: string;
  projectName?: string;
  framework?: string;
  language?: string;
  lastOpened: number;
  createdAt: number;
}

export class WorkspaceManager {
  private entries: WorkspaceEntry[] = [];
  private loaded = false;

  private load(): WorkspaceEntry[] {
    if (this.loaded) return this.entries;
    this.entries = [];
    try {
      if (existsSync(WORKSPACES_PATH)) {
        const raw = readFileSync(WORKSPACES_PATH, "utf-8");
        this.entries = JSON.parse(raw);
      }
    } catch {
      // Corrupt or missing file — start fresh
      this.entries = [];
    }
    this.loaded = true;
    return this.entries;
  }

  private save(): void {
    const dir = dirname(WORKSPACES_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(WORKSPACES_PATH, JSON.stringify(this.entries, null, 2));
  }

  list(): WorkspaceEntry[] {
    return this.load();
  }

  get(id: string): WorkspaceEntry | null {
    return this.load().find((e) => e.id === id) ?? null;
  }

  findByPath(absPath: string): WorkspaceEntry | null {
    return this.load().find((e) => e.path === absPath) ?? null;
  }

  add(entry: Omit<WorkspaceEntry, "id" | "createdAt" | "lastOpened">): WorkspaceEntry {
    const existing = this.findByPath(entry.path);
    if (existing) {
      // Update existing entry
      existing.name = entry.name;
      existing.projectName = entry.projectName;
      existing.framework = entry.framework;
      existing.language = entry.language;
      existing.lastOpened = Date.now();
      this.save();
      return existing;
    }

    const newEntry: WorkspaceEntry = {
      id: randomUUID(),
      path: entry.path,
      name: entry.name,
      projectName: entry.projectName,
      framework: entry.framework,
      language: entry.language,
      lastOpened: Date.now(),
      createdAt: Date.now(),
    };
    this.load().push(newEntry);
    this.save();
    return newEntry;
  }

  remove(id: string): boolean {
    const idx = this.load().findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    this.save();
    return true;
  }

  touch(id: string): void {
    const entry = this.get(id);
    if (entry) {
      entry.lastOpened = Date.now();
      this.save();
    }
  }
}
