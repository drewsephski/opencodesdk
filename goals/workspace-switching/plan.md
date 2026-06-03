# Plan — Workspace Functionality

## Solution Approach

Add workspace management to both the squid-chat CLI and the studio-chat UI. A new `WorkspaceManager` class handles CRUD on a JSON file at `~/.squid-chat/workspaces/workspaces.json`. The CLI gets a `workspace` subcommand (add/list/remove/switch). The UI gets a workspace picker in the header with search, drag-drop, and file picker. Switching workspaces triggers an OpenCode server restart via a marker file.

---

## Steps

### Step 1 — Create WorkspaceManager class

**Files:** `packages/squid-chat/src/workspace.ts` (new)

- Export `WorkspaceEntry` interface (id, path, name, projectName?, framework?, language?, lastOpened, createdAt)
- Export `WorkspaceManager` class with methods:
  - `list()` → `WorkspaceEntry[]`
  - `get(id)` → `WorkspaceEntry | null`
  - `add(entry)` → create/update entry, write JSON
  - `remove(id)` → delete entry, write JSON
  - `findByPath(path)` → find entry by absolute path
- Load/save from `WORKSPACES_DIR + "/workspaces.json"` (already defined in paths.ts)
- Generate UUIDs for new entries

**Verification:** `node -e "new (require('./workspace').WorkspaceManager)().add({path:'/tmp/test',name:'test'}); console.log(new (require('./workspace').WorkspaceManager)().list())"`

---

### Step 2 — Add workspace CLI subcommand

**Files:**
- `packages/squid-chat/src/commands/workspace.ts` (new)
- `packages/squid-chat/src/cli.ts` (modify)

New file `commands/workspace.ts`:
- Export `workspaceCommand(args: string[])` handler
- Parse `add`, `list`, `remove`, `switch` subcommands
- `add <path>`: resolve path, run `detectProject(path)`, create `WorkspaceEntry`, save, print result
- `list`: print table of workspaces (id, name, path, framework, lastOpened)
- `remove <id>`: remove entry, confirm before delete
- `switch <id>`: get entry, write restart marker file, exit current process

In `cli.ts`:
- Add `case "workspace":` after the existing switch cases
- Route to `workspaceCommand(process.argv.slice(3))`

**Risks:**
- `workspace switch` needs the running instance to detect the restart marker. The CLI and UI server need to coordinate. For now, `switch` writes the marker and exits — the running instance detects it.

**Verification:**
```bash
node dist/cli.js workspace add /tmp
node dist/cli.js workspace list
node dist/cli.js workspace remove <id>
```

---

### Step 3 — Modify startCommand for auto-detect + restart watching

**Files:**
- `packages/squid-chat/src/commands/start.ts` (modify)
- `packages/squid-chat/src/paths.ts` (modify — add `RESTART_MARKER_PATH`)

Changes to `startCommand()`:
1. Accept optional `cwd` parameter (for workspace switch)
2. After starting servers and detecting project:
   - If project detected AND not already in workspace list → auto-add it (print console notice)
   - If already in list → update `lastOpened`
3. Replace `await new Promise(() => {})` with a polling loop:
   - Periodically check for restart marker file (e.g., every 1s via `setInterval`)
   - If marker file exists and contains a different workspace path:
     - Kill current servers
     - Clear state
     - Restart `startCommand()` with new CWD
4. Set `process.chdir(workspacePath)` before restarting (so the OpenCode server starts in the right dir)

Add restart marker path:
- `packages/squid-chat/src/paths.ts`: `export const RESTART_MARKER_PATH = join(BASE, "run", "restart.json")`
- Marker format: `{ cwd: string, workspaceId: string, timestamp: number }`

**Verification:** Start squid-chat in a project dir, confirm auto-add via `squid-chat workspace list`. Test restart marker detection manually.

---

### Step 4 — Add workspace API routes

**Files:**
- `apps/studio-chat/app/api/workspace/list/route.ts` (new)
- `apps/studio-chat/app/api/workspace/switch/route.ts` (new)

`GET /api/workspace/list`:
- The Next.js server has no direct filesystem access to the CLI's workspace file unless it runs in the same context. For dev mode (studio-chat standalone), read from `~/.squid-chat/workspaces/workspaces.json` directly.
- Return workspace list as JSON.

`POST /api/workspace/switch`:
- Accept `{ workspaceId: string }` in body
- Look up the workspace entry from the JSON file
- Verify the directory exists (if not, return 400 with error + options for Remove/Re-link)
- Write restart marker file at `~/.squid-chat/run/restart.json` with `{ cwd, workspaceId, timestamp }`
- If running under squid-chat CLI (marker detected), the CLI handles restart
- If running standalone (dev mode), handle differently — either reload or show instructions
- Return `{ success: true, workspacePath }`

**Verification:** `curl http://127.0.0.1:PORT/api/workspace/list`

---

### Step 5 — Add workspace state to useStudioChat

**File:** `apps/studio-chat/app/useStudioChat.ts` (modify)

Add to `StudioChatState`:
- `workspaces: WorkspaceEntry[]`
- `activeWorkspace: WorkspaceEntry | null`
- `loadWorkspaces: () => Promise<void>`
- `switchWorkspace: (id: string) => Promise<void>`
- `addWorkspace: (path: string) => Promise<void>`
- `removeWorkspace: (id: string) => Promise<void>`
- `isReconnecting: boolean`

Implementation:
- On mount, fetch `/api/workspace/list` to load workspaces
- Track active workspace in localStorage (`squid-active-workspace`)
- `switchWorkspace`: POST to `/api/workspace/switch`, set `isReconnecting = true`, then monitor for server availability (poll health endpoint), clear sessions and reload when reconnected
- `isReconnecting` state triggers a reconnection overlay in the UI

**Verification:** Component renders with workspace state accessible.

---

### Step 6 — Build WorkspaceSwitcher header component

**File:** `apps/studio-chat/app/WorkspaceSwitcher.tsx` (new)

- Shows current workspace name + framework badge next to the squid-chat logo in the header
- If no workspace active, shows "Select Workspace…" as a subtle button
- Clicking opens the WorkspacePicker overlay
- Inline rename: double-click the name to edit inline (input replaces text, Enter/Blur saves)

Placement: Insert into the header alongside the squid-chat logo block (around line 1075 of page.tsx).

Props: `{ activeWorkspace, workspaces, onSwitch, onAdd, onRemove, onRename, isReconnecting }`

**Verification:** Header shows workspace name after selection.

---

### Step 7 — Build WorkspacePicker overlay

**File:** `apps/studio-chat/app/WorkspacePicker.tsx` (new)

Overlay with:
- Search input to filter workspaces by name/path
- List of workspaces with: name, path (truncated), framework badge, last opened date
- "Switch" button per workspace — triggers confirmation if messages exist
- "Open Folder…" button — uses `<input type="file" webkitdirectory>` or native directory picker
- Drag-drop zone — accepts folder drops from Finder
- "Remove" action per workspace (with confirmation)
- Confirmation dialog when switching mid-conversation: "Switch workspace? This will end your current conversation. Your sessions for this workspace will be available when you switch back."
- Empty state: "No workspaces yet. Open a folder to get started."
- Reconnecting state overlay: "Reconnecting…" with spinner, auto-reconnects

**Verification:** Open picker, search, switch, drag folder, open folder picker.

---

### Step 8 — Integrate workspace components into page.tsx

**File:** `apps/studio-chat/app/page.tsx` (modify)

Changes:
- Import `WorkspaceSwitcher` and add it to the header (next to the logo)
- Import workspace state from `useStudioChat`
- Conditionally show workspace picker as landing screen if no active workspace (replacing the "Start a conversation" empty state)
- Show reconnection overlay when `isReconnecting`
- Pass confirmation dialog trigger through to WorkspacePicker

The landing screen when no workspace: Show the workspace picker with a message "Select a workspace to begin" instead of the chat suggestions grid.

**Verification:** App works with and without workspaces.

---

### Step 9 — Handle reconnection UX on switch

**File:** `apps/studio-chat/app/WorkspacePicker.tsx` and `page.tsx` (modify)

- When `switchWorkspace` is called, show full-screen "Reconnecting…" overlay
- Periodically poll `/api/health` (every 1s) until the server responds
- Once health returns OK, reload workspace list, clear conversation, remove overlay
- If reconnection takes >30s, show error with "Retry" and "Cancel" buttons
- On cancel, reset to previous workspace state

**Verification:** Switch workspace, observe reconnection flow.

---

### Step 10 — macOS Quick Action

**Files:** New `.workflow` file (packaged with distribution)

- Create an Automator workflow that:
  1. Receives selected folders in Finder
  2. Runs `squid-chat workspace add "$1" && squid-chat workspace switch $(squid-chat workspace list --json | ...)`
  3. Saves as "Open with squid-chat.workflow" in `~/Library/Services/`
- Document the installation steps

This is the lowest priority step and can be deferred if needed.

**Verification:** Right-click a folder in Finder → Services → "Open with squid-chat"

---

## Risks & Open Questions

| Risk | Mitigation |
|------|------------|
| **Workspace switch requires CLI process to be running** | If studio-chat runs standalone (dev mode), the switch API can't restart the OpenCode server. Handle gracefully: show a message "Workspace switch requires squid-chat CLI" or use an alternative approach (refresh page with new query param) |
| **DetectProject() only checks CWD for package.json** | That's fine — it's the existing behavior and matches the spec (auto-detect recognizable projects) |
| **File system access from browser (drag-drop)** | Browsers don't expose folder paths for security reasons. The drag-drop feature may need Electron or a native bridge. For the web UI, the "Open Folder…" file picker using `webkitdirectory` is the reliable approach. Drag-drop can be limited to file uploading, not folder path detection. |
| **Multiple instances with different workspaces** | The state/lock file prevents multiple instances. The restart marker approach handles single-instance switching. |
| **Timing: server restarts while client is polling** | Health check polling handles this — the UI just waits until the server responds. |
