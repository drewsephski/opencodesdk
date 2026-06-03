---
sessionID: ses_171feb7dcffeIeFAx6FViPebO5
baseMessageCount: 0
updatedAt: 2026-06-03T15:06:04.544Z
status: finalized
---

# Workspace Functionality for squid-chat

## Overview

Add workspace (project) management to squid-chat, allowing users to switch between multiple project directories from both the CLI and the web UI, and to open squid-chat in a chosen folder from Finder.

---

## 1. Data Model

### Workspace Entry

```typescript
interface WorkspaceEntry {
  id: string;                    // UUID, generated once
  path: string;                  // Absolute filesystem path
  name: string;                  // Derived from project name, user-editable in UI
  projectName?: string;          // From project detection
  framework?: string;            // e.g. "Next.js 15", "Vite", "Node.js"
  language?: string;             // "TypeScript" | "JavaScript"
  lastOpened: number;            // Unix ms timestamp
  createdAt: number;             // Unix ms timestamp
}
```

### Persistence

- **File:** `~/.squid-chat/workspaces/workspaces.json`
- **Format:** `WorkspaceEntry[]`
- **Pattern:** matches existing config pattern (`config.ts` / `paths.ts`)
- The constant `WORKSPACES_DIR` already exists at `~/.squid-chat/workspaces` in `paths.ts` — it will be used for the JSON file.

### Other Storage Changes

Session storage is already server-side (OpenCode server). Sessions are implicitly scoped per-workspace because restarting the OpenCode server with a new CWD means the server's session list naturally reflects that workspace's sessions. No additional session-to-workspace mapping is needed.

---

## 2. CLI Commands

```
squid-chat workspace add <path>    — Add a folder as a workspace
squid-chat workspace list           — List all workspaces
squid-chat workspace remove <id>    — Remove a workspace
squid-chat workspace switch <id>    — Switch to a different workspace
```

### Behavior

- **`workspace add <path>`**: Detects project at path; if recognized, creates a `WorkspaceEntry` and saves it. If already in the list, updates the existing entry (refreshes project info, resets `lastOpened`). Prints the workspace ID.
- **`workspace list`**: Pretty-prints all workspaces (ID, name, path, project info). If no workspaces, prints a message.
- **`workspace remove <id>`**: Removes the workspace entry from the JSON list. If it was the active workspace, the CLI continues running but the UI will show the workspace picker on next open.
- **`workspace switch <id>`**: Restarts the OpenCode server and UI server with the workspace path as CWD. If squid-chat is already running, the current process shuts down and a new one starts (or the UI triggers a reload pointing to the new server). The user's browser tab navigates to the new instance.

---

## 3. UI Workspace Picker (studio-chat)

### Components to add

1. **WorkspaceSwitcher** — dropdown or sidebar section in the header showing current workspace name, click to open a workspace picker overlay.
2. **WorkspacePicker** — overlay/modal listing all workspaces with search, project badges, and a "Switch" button. Includes an "Open Folder…" button that triggers a native directory picker.
3. **WorkspaceSettings** — inline editing of workspace name (derived → editable), and a "Remove" action.

### UX Flow

- **Header**: Shows the current workspace name + project badge next to the squid-chat logo. This is clickable to open the picker.
- **On load**: If no workspace is active, show the workspace picker as a landing screen.
- **Switch**: Selecting a workspace triggers a call to the backend (`POST /api/workspace/switch`), which causes the OpenCode server to restart. The UI shows a "Reconnecting…" state and then reloads sessions from the new instance.
- **Session sidebar**: Session history is scoped to the active workspace (since it's server-side scoped).

### Drag-and-Drop

- The workspace picker / empty-state screen accepts a folder drag from Finder.
- On drop: reads the dropped folder path (via Electron-like bridge or a web API like `webkitGetAsEntry` / `FileSystemEntry`), auto-detects the project, and switches to it.

---

## 4. Backend (OpenCode Server Restart)

### New API Route: `POST /api/workspace/switch`

```typescript
// Request body
{ workspaceId: string }

// Response
{ success: true, message: "Restarting with workspace: <path>" }

// The Next.js API handler:
// 1. Reads the workspace entry from the JSON file
// 2. Writes the chosen workspace path to a "pending restart" marker file
// 3. The CLI process watches for this marker and restarts with the new CWD
// 4. Returns a response, then the UI detects disconnection and shows reconnect UI
```

**Alternative approach** (if simpler): The API route returns the new URL/port and the client navigates there.

### Startup Auto-Detect

On `squid-chat start`:
1. Run `detectProject()` on CWD
2. If a recognizable project is found:
   - Check if it's already in the workspace list (by path)
   - If not, auto-add it with a console notice: `✓ Added workspace "<name>" (<path>)`
   - If it is, update `lastOpened` and refresh project info
3. If no recognizable project is found, start without a workspace — UI shows the workspace picker

---

## 5. Finder Integration

Three methods, all supported:

### a. macOS Quick Action / Service
- Register a macOS Service that receives folder paths and launches `squid-chat workspace add <path> && squid-chat workspace switch <id>`.
- Bundle with the app's `.workflow` or use `automator` to create a "Quick Action" in Finder.
- Entry point: right-click a folder → Quick Actions → "Open with squid-chat".

### b. Drag-and-Drop
- Implemented in the workspace picker UI (see §3). Uses the File System Access API (`DataTransferItem.getAsFileSystemHandle` or similar) to capture the dropped folder path from Finder.

### c. File Picker ("Open Folder")
- A standard `<input type="file" webkitdirectory>` or similar browser file picker, configured to select directories.
- The chosen folder path is passed to the workspace add + switch flow.

---

## 6. Session Scoping

Sessions are implicitly scoped per-workspace because:
- Each OpenCode server instance runs against its own CWD
- The OpenCode SDK creates sessions relative to the server's working directory
- Restarting the server with a new CWD naturally scopes sessions

No explicit session-to-workspace mapping table is needed.

**Caveat**: When switching workspaces, the current session (if any) will be lost from the UI perspective. Consider a warning: *"Switching workspace will end the current conversation. Sessions for this workspace will be available when you switch back."*

---

## 7. Implementation Order

| Step | Description | Area |
|------|-------------|------|
| 1 | Create `WorkspaceManager` class — read/write `workspaces.json`, CRUD operations | `packages/squid-chat` |
| 2 | Add `workspace` subcommand to CLI (add/list/remove/switch) | `packages/squid-chat` |
| 3 | Modify `startCommand()` to auto-detect and auto-add workspace | `packages/squid-chat` |
| 4 | Modify `startCommand()` to accept a `--workspace` / `--cwd` flag | `packages/squid-chat` |
| 5 | Add `POST /api/workspace/switch` route in studio-chat | `apps/studio-chat` |
| 6 | Add `GET /api/workspace/list` route | `apps/studio-chat` |
| 7 | Build `WorkspaceSwitcher` component in the header | `apps/studio-chat` |
| 8 | Build `WorkspacePicker` overlay with search, drag-drop, and file picker | `apps/studio-chat` |
| 9 | Add session-scoped loading (re-fetch sessions on workspace change) | `apps/studio-chat` |
| 10 | macOS Quick Action / Service integration | packaging |

---

## 8. File Changes Summary

### New files
- `packages/squid-chat/src/workspace.ts` — `WorkspaceManager` class, `WorkspaceEntry` type
- `packages/squid-chat/src/commands/workspace.ts` — workspace subcommand handler
- `apps/studio-chat/app/api/workspace/list/route.ts` — GET workspace list
- `apps/studio-chat/app/api/workspace/switch/route.ts` — POST switch workspace
- `apps/studio-chat/app/WorkspaceSwitcher.tsx` — header component
- `apps/studio-chat/app/WorkspacePicker.tsx` — overlay component

### Modified files
- `packages/squid-chat/src/cli.ts` — register workspace subcommand
- `packages/squid-chat/src/commands/start.ts` — auto-detect + accept `--cwd`
- `packages/squid-chat/src/paths.ts` — (already has `WORKSPACES_DIR`)
- `apps/studio-chat/app/page.tsx` — add workspace switcher to header, handle workspace-aware states
- `apps/studio-chat/app/layout.tsx` — pass workspace context if needed
