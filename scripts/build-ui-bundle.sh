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

echo "1/3 Building Next.js app..."
cd "$APP_DIR"
bun run build

echo "2/3 Packaging standalone output..."
mkdir -p "$DIST_DIR"

TMP_DIR=$(mktemp -d)

# The standalone output location varies by package manager and platform.
# Search for server.js inside the standalone directory.
echo "  Locating standalone output..."
SERVER_JS=$(find "$BUILD_DIR" -name "server.js" -maxdepth 5 | head -1)
if [ -z "$SERVER_JS" ]; then
  echo "ERROR: Could not find server.js in $BUILD_DIR"
  echo "  Contents of $BUILD_DIR:"
  find "$BUILD_DIR" -maxdepth 4 -type d 2>/dev/null | head -20
  exit 1
fi
echo "  Found: $SERVER_JS"

# Determine the app root inside standalone output
STANDALONE_APP_DIR="$(dirname "$SERVER_JS")"
echo "  App root: $STANDALONE_APP_DIR"

# Copy the server app files
cp -R "$STANDALONE_APP_DIR/." "$TMP_DIR/"

# Copy node_modules if they exist at a parent level (workspace hoisting)
PARENT_DIR="$(dirname "$STANDALONE_APP_DIR")"
if [ -d "$PARENT_DIR/../node_modules" ]; then
  echo "  Copying hoisted node_modules..."
  mkdir -p "$TMP_DIR/node_modules"
  cp -R "$PARENT_DIR/../node_modules/." "$TMP_DIR/node_modules/"
fi

# Also check at BUILD_DIR level
if [ -d "$BUILD_DIR/node_modules" ]; then
  echo "  Copying build-level node_modules..."
  mkdir -p "$TMP_DIR/node_modules"
  cp -R "$BUILD_DIR/node_modules/." "$TMP_DIR/node_modules/"
fi

# Copy public assets
if [ -d "$APP_DIR/public" ]; then
  mkdir -p "$TMP_DIR/public"
  cp -R "$APP_DIR/public/." "$TMP_DIR/public/"
fi

cd "$TMP_DIR"

echo "3/3 Creating tarball..."
tar -czf "$TARBALL" .

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
