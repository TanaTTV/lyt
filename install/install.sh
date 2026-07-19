#!/usr/bin/env bash
# Installs lyt, yt3, and yt4 and verifies the local media toolchain.
# Package managers are preferred; lyt's verified per-user yt-dlp binary is the
# fallback when yt-dlp is not available through the current platform.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing lyt commands (lyt, yt3, yt4)..."

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 20 or newer is required." >&2
  echo "  macOS:  brew install node" >&2
  echo "  Linux:  install the current Node.js LTS with your package manager" >&2
  exit 1
fi

node_version="$(node -p 'process.versions.node')"
node_major="${node_version%%.*}"
if ! [[ "$node_major" =~ ^[0-9]+$ ]] || [ "$node_major" -lt 20 ]; then
  echo "Error: Node.js 20 or newer is required; found $node_version." >&2
  exit 1
fi

(cd "$root" && npm install -g .)

install_with_package_manager() {
  pkg="$1"

  if command -v brew >/dev/null 2>&1; then
    brew install "$pkg" && return 0
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y "$pkg" && return 0
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "$pkg" && return 0
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm "$pkg" && return 0
  fi

  return 1
}

if command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is already installed."
else
  echo "Installing ffmpeg with the platform package manager..."
  if ! install_with_package_manager ffmpeg; then
    echo "Warning: ffmpeg could not be installed automatically." >&2
    echo "  Install it with brew, apt, dnf, pacman, or your distribution's package manager." >&2
  fi
fi

if command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp is already installed."
else
  echo "Installing yt-dlp..."
  if ! install_with_package_manager yt-dlp; then
    echo "Falling back to lyt's checksum-verified per-user yt-dlp download..."
    node "$root/bin/lyt.js" doctor --fix
  fi
fi

managed_bin="${XDG_DATA_HOME:-$HOME/.local/share}/lyt/bin"
if [ "$(uname)" = "Darwin" ]; then
  managed_bin="$HOME/Library/Application Support/lyt/bin"
fi

resolve_tool() {
  tool="$1"
  if command -v "$tool" >/dev/null 2>&1; then
    command -v "$tool"
  elif [ -x "$managed_bin/$tool" ]; then
    echo "$managed_bin/$tool"
  fi
}

echo
echo "Verifying installed versions:"
echo "  node    $node_version"

for tool in yt-dlp ffmpeg; do
  exe="$(resolve_tool "$tool" || true)"
  if [ -n "$exe" ]; then
    if [ "$tool" = "ffmpeg" ]; then
      version="$("$exe" -version 2>/dev/null | head -n1 | sed 's/^ffmpeg version //' | cut -d' ' -f1)"
    else
      version="$("$exe" --version 2>/dev/null | head -n1)"
    fi
    printf '  %-7s %s\n' "$tool" "$version"
  else
    echo "Warning: $tool is unavailable. Run: lyt doctor" >&2
  fi
done

echo
echo "Done. Try:"
echo '  yt3 "https://www.youtube.com/watch?v=VIDEO_ID"   # native audio'
echo '  yt4 "https://www.youtube.com/watch?v=VIDEO_ID"   # video'
echo '  yt3 --paste                                       # download from clipboard'
