# squid-chat

A beautiful chat UI for OpenCode SDK — run locally in any project.

```bash
npx squid-chat
```

## Project structure

```
├── apps/studio-chat/       # Next.js chat UI
├── packages/squid-chat/    # CLI (published to npm as `squid-chat`)
├── scripts/                # Build + install scripts
└── goals/                  # Goal packages
```

## Development

```bash
bun install
bun --cwd apps/studio-chat dev     # Start dev server
bun --cwd packages/squid-chat build # Build CLI
bash scripts/build-ui-bundle.sh    # Package UI bundle
```
