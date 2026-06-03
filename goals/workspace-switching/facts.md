# Facts — Workspace Functionality

- squid-chat CLI provides a `workspace` subcommand with `add`, `list`, `remove`, and `switch` actions
- squid-chat workspace add <path> runs project detection on the given path and creates a workspace entry with the detected info
- On squid-chat start, if the current directory contains a recognizable project that is not already in the workspace list, it is auto-added with a console notice
- Workspace entries are stored in ~/.squid-chat/workspaces/workspaces.json as an array of WorkspaceEntry objects
- Each workspace entry contains: id (UUID), path (absolute), name (derived, user-editable), projectName, framework, language, lastOpened, createdAt
- studio-chat header shows the current workspace name and project badge, clickable to open the workspace picker
- The workspace picker overlay lists all workspaces with search, project badges, and a 'Switch' button
- The workspace picker includes an 'Open Folder…' button that opens a native directory picker
- The workspace picker accepts folder drag-and-drop from Finder to add a workspace
- Switching workspaces mid-conversation shows a confirmation dialog: 'Switch workspace? This will end your current conversation.'
- On confirmed workspace switch, the OpenCode server is restarted with the chosen workspace path as CWD
- During server restart, the UI shows a 'Reconnecting…' overlay and auto-reconnects when the new server is ready
- Sessions are scoped per-workspace: each workspace has its own session history via the server's CWD-based session storage
- Workspace names are editable from the UI (derived from project name by default)
- Workspace entries can be removed both from CLI (squid-chat workspace remove <id>) and from the UI workspace settings
- If a workspace directory no longer exists when switching to it, the UI shows an error with 'Remove' or 'Re-link' options
- A macOS Quick Action is available: right-click a folder in Finder → 'Open with squid-chat'
