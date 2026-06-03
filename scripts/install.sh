#!/usr/bin/env bash
set -euo pipefail

REPO="drewsepeczi/opencodesdk"
INSTALL_DIR="${HOME}/.local/bin"
VERSION="${1:-latest}"

echo "Installing squid-chat..."
echo ""

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}-${ARCH}" in
  Darwin-arm64)  TARGET="aarch64-apple-darwin" ;;
  Darwin-x86_64) TARGET="x86_64-apple-darwin" ;;
  Linux-x86_64)  TARGET="x86_64-unknown-linux-gnu" ;;
  Linux-arm64)   TARGET="aarch64-unknown-linux-gnu" ;;
  *)
    echo "Unsupported platform: ${OS} ${ARCH}"
    echo "squid-chat requires macOS (arm64/x64) or Linux (x64/arm64)."
    exit 1
    ;;
esac

# Determine download URL
if [ "$VERSION" = "latest" ]; then
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/squid-chat-cli-${TARGET}.tar.gz"
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/squid-chat-cli-${TARGET}.tar.gz"
fi

# Download
TMP_DIR="$(mktemp -d)"
echo "  Downloading squid-chat for ${OS}/${ARCH}..."

if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/squid-chat.tar.gz"
elif command -v wget &>/dev/null; then
  wget -q "$DOWNLOAD_URL" -O "$TMP_DIR/squid-chat.tar.gz"
else
  echo "Error: need curl or wget to download"
  exit 1
fi

# Extract
echo "  Extracting..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_DIR/squid-chat.tar.gz" -C "$TMP_DIR"
cp "$TMP_DIR/squid-chat" "$INSTALL_DIR/squid-chat"
chmod +x "$INSTALL_DIR/squid-chat"

# Cleanup
rm -rf "$TMP_DIR"

# Add to PATH if not already
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  SHELL_CONFIG=""
  case "${SHELL:-}" in
    */zsh) SHELL_CONFIG="$HOME/.zshrc" ;;
    */bash) SHELL_CONFIG="$HOME/.bashrc" ;;
  esac
  if [ -n "$SHELL_CONFIG" ]; then
    echo "" >> "$SHELL_CONFIG"
    echo "# Added by squid-chat installer" >> "$SHELL_CONFIG"
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$SHELL_CONFIG"
    echo ""
    echo "  Added $INSTALL_DIR to PATH in $SHELL_CONFIG"
    echo "  Restart your terminal or run: source $SHELL_CONFIG"
  fi
fi

echo ""
echo "\u2713 squid-chat installed to $INSTALL_DIR/squid-chat"
echo "  Run \`squid-chat\` to start."
