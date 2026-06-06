#!/usr/bin/env bash
# Installs the yt2audio commands (yt3, yt4, yt2audio) onto your PATH.
#
# Run from anywhere:
#   bash install/install.sh

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing yt2audio commands (yt3, yt4, yt2audio)..."

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 20+ is required." >&2
  echo "  macOS:  brew install node" >&2
  echo "  Linux:  use your distro package manager" >&2
  exit 1
fi

(cd "$root" && npm install -g .)

for tool in yt-dlp ffmpeg; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Warning: $tool was not found on PATH. Downloads need it."
    if [ "$tool" = "yt-dlp" ]; then
      echo "  macOS: brew install yt-dlp   (or see the yt-dlp install docs)"
    else
      echo "  macOS: brew install ffmpeg   (needed for --mp3 and video muxing)"
    fi
  fi
done

echo
echo "Done. Try:"
echo '  yt3 "https://www.youtube.com/watch?v=VIDEO_ID"   # audio'
echo '  yt4 "https://www.youtube.com/watch?v=VIDEO_ID"   # video'
