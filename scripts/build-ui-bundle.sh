#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$ROOT_DIR/apps/studio-chat"
BUILD_DIR="$APP_DIR/.next/standalone"
DIST_DIR="$ROOT_DIR/dist"
VERSION="${1:-$(node -p "require('$ROOT_DIR/packages/squid-chat/package.json').version")}"
TARBALL="$DIST_DIR/squid-chat-ui-v$VERSION.tar.gz"
SHA_FILE="$DIST_DIR/squid-chat-ui-v$VERSION.tar.gz.sha256"

echo "Building UI bundle v$VERSION..."
echo ""

# Build the Next.js app
echo "1/3 Building Next.js app..."
cd "$APP_DIR"
bun run build

# Prepare the tarball directory
echo "2/3 Packaging standalone output..."
mkdir -p "$DIST_DIR"

TMP_DIR=$(mktemp -d)

# The standalone output with npm workspaces is at:
# .next/standalone/opencodesdk/  <- includes hoisted node_modules
# .next/standalone/opencodesdk/apps/studio-chat/  <- the app itself
STANDALONE_ROOT="$BUILD_DIR/opencodesdk"
STANDALONE_APP="$STANDALONE_ROOT/apps/studio-chat"

# Copy the server app files
cp -R "$STANDALONE_APP/." "$TMP_DIR/"

# Copy the hoisted node_modules from the workspace root level
if [ -d "$STANDALONE_ROOT/node_modules" ]; then
  mkdir -p "$TMP_DIR/node_modules"
  cp -R "$STANDALONE_ROOT/node_modules/." "$TMP_DIR/node_modules/"
fi

# Copy public assets
if [ -d "$APP_DIR/public" ]; then
  mkdir -p "$TMP_DIR/public"
  cp -R "$APP_DIR/public/." "$TMP_DIR/public/"
fi

cd "$TMP_DIR"

# Create tarball
echo "3/3 Creating tarball..."
tar -czf "$TARBALL" .

# Generate checksum
shasum -a 256 "$TARBALL" | awk '{print $1}' > "$SHA_FILE"

cd "$ROOT_DIR"
rm -rf "$TMP_DIR"

echo ""
echo "UI bundle created:"
echo "  $TARBALL"
echo "  $(du -h "$TARBALL" | awk '{print $1}')"
echo "  SHA256: $(cat "$SHA_FILE")"
echo ""
echo "Done!"
