# Workspace Functionality for squid-chat

Add workspace management to squid-chat, allowing users to switch between project directories from both the CLI and the web UI, and to open squid-chat in a chosen folder from Finder.

## Shared Understanding

See [facts.md](./facts.md) for the detailed fact sheet — 17 verifiable outcomes covering CLI commands, UI components, session scoping, error handling, and Finder integration.

## Execution Plan

See [plan.md](./plan.md) for the ordered 10-step implementation plan, covering:
- WorkspaceManager class (CRUD on JSON file)
- CLI workspace subcommand (add/list/remove/switch)
- Auto-detect projects on startup
- API routes (list, switch)
- WorkspaceSwitcher + WorkspacePicker UI components
- Server restart + reconnection flow
- macOS Quick Action

## Done Condition

- `squid-chat workspace add|list|remove|switch` commands work from the terminal
- studio-chat header shows the active workspace; clicking opens the workspace picker
- Switching workspaces shows a confirmation dialog (if conversation active), restarts the server, reconnects the UI
- Workspaces are persisted across restarts
- Sessions are scoped per-workspace
- Auto-add on startup for recognizable projects
- "Open Folder…" and drag-drop work in the workspace picker
- Stale directory errors show Remove/Re-link options
