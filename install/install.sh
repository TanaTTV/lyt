#!/usr/bin/env bash
# Installs the lyt commands (lyt, yt3, yt4) onto your PATH and makes sure
# yt-dlp and ffmpeg are actually installed — package manager first (brew /
# apt / dnf / pacman), then lyt's own managed download for yt-dlp
# (checksum-verified, per-user).
#
# Safe to re-run: every step is skipped when it is already done.
#
# Run from anywhere:
#   bash install/install.sh

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing lyt commands (lyt, yt3, yt4)..."

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 20+ is required." >&2
  echo "  macOS:  brew install node" >&2
  echo "  Linux:  use your distro package manager" >&2
  exit 1
fi

(cd "$root" && npm install -g .)

# ---------------------------------------------------------------------------
# yt-dlp / ffmpeg: install for real instead of just warning.
# ---------------------------------------------------------------------------

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
  echo "Installing ffmpeg..."
  if ! install_with_package_manager ffmpeg; then
    echo "Warning: could not install ffmpeg automatically." >&2
    echo "  Install it with your package manager (e.g. brew/apt/dnf/pacman install ffmpeg)." >&2
  fi
fi

if command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp is already installed."
else
  echo "Installing yt-dlp..."
  if ! install_with_package_manager yt-dlp; then
    # Fall back to lyt's managed download: the official binary is fetched
    # into the per-user data dir and checksum-verified. No root needed.
    echo "Falling back to lyt's managed download (per-user, no root)..."
    node "$root/bin/lyt.js" doctor --fix || true
  fi
fi

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

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
echo "  node    $(node --version)"

for tool in yt-dlp ffmpeg; do
  exe="$(resolve_tool "$tool")"
  if [ -n "$exe" ]; then
    if [ "$tool" = "ffmpeg" ]; then
      version="$("$exe" -version 2>/dev/null | head -n1 | sed 's/^ffmpeg version //' | cut -d' ' -f1)"
    else
      version="$("$exe" --version 2>/dev/null | head -n1)"
    fi
    printf '  %-7s %s\n' "$tool" "$version"
  else
    echo "Warning: $tool is still missing. Run: node \"$root/bin/lyt.js\" doctor --fix" >&2
  fi
done

echo
echo "Done. Try:"
echo '  yt3 "https://www.youtube.com/watch?v=VIDEO_ID"   # audio'
echo '  yt4 "https://www.youtube.com/watch?v=VIDEO_ID"   # video'
echo '  yt3 --paste                                       # download from clipboard'
