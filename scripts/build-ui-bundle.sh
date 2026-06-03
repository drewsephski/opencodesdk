#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$ROOT_DIR/apps/studio-chat"
DIST_DIR="$ROOT_DIR/dist"
VERSION="${1:-$(node -p "require('$ROOT_DIR/packages/squid-chat/package.json').version")}"
TARBALL="$DIST_DIR/squid-chat-ui-v$VERSION.tar.gz"
SHA_FILE="$DIST_DIR/squid-chat-ui-v$VERSION.tar.gz.sha256"

echo "Building UI bundle v$VERSION..."
echo ""

echo "1/4 Preparing clean build environment..."
BUILD_DIR=$(mktemp -d)
echo "  Build dir: $BUILD_DIR"

cp -R "$APP_DIR/." "$BUILD_DIR/app/"
cd "$BUILD_DIR/app"

# Remove any workspace artifacts that could interfere
rm -rf node_modules package-lock.json bun.lock

echo "2/4 Installing dependencies with npm..."
npm install --ignore-scripts --no-audit --no-fund --loglevel=warn 2>&1 | tail -3

echo "3/4 Building Next.js app..."
npx next build 2>&1 | tail -10

echo "4/4 Packaging standalone output..."
mkdir -p "$DIST_DIR"

SERVER_JS=$(find ".next/standalone" -name "server.js" -maxdepth 5 | head -1)
if [ -z "$SERVER_JS" ]; then
  echo "ERROR: Could not find server.js"
  find ".next/standalone" -maxdepth 4 -type d | head -20
  exit 1
fi
echo "  Found: $SERVER_JS"

STANDALONE_APP_DIR="$(dirname "$SERVER_JS")"
TMP_DIR=$(mktemp -d)

cp -R "$STANDALONE_APP_DIR/." "$TMP_DIR/"

# Copy node_modules (npm produces flat, non-symlinked structures)
PARENT_DIR="$(dirname "$STANDALONE_APP_DIR")"
if [ -d "$PARENT_DIR/../node_modules" ]; then
  echo "  Copying hoisted node_modules..."
  mkdir -p "$TMP_DIR/node_modules"
  cp -R "$PARENT_DIR/../node_modules/." "$TMP_DIR/node_modules/"
fi

# Copy public assets
if [ -d "$APP_DIR/public" ]; then
  mkdir -p "$TMP_DIR/public"
  cp -R "$APP_DIR/public/." "$TMP_DIR/public/"
fi

cd "$TMP_DIR"
tar -czf "$TARBALL" .
shasum -a 256 "$TARBALL" | awk '{print $1}' > "$SHA_FILE"

cd "$ROOT_DIR"
rm -rf "$BUILD_DIR" "$TMP_DIR"

echo ""
echo "UI bundle created:"
echo "  $TARBALL"
echo "  $(du -h "$TARBALL" | awk '{print $1}')"
echo "  SHA256: $(cat "$SHA_FILE")"
echo "Done!"
