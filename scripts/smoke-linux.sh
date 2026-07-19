#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
smoke_root="$(mktemp -d)"
trap 'rm -rf -- "$smoke_root"' EXIT

cd "$repo_root"
npm pack --pack-destination "$smoke_root" --json > "$smoke_root/pack.json"
tarball="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p[0].filename)' "$smoke_root/pack.json")"
npm install -g --prefix "$smoke_root/prefix" "$smoke_root/$tarball" >/dev/null

mode_args=(--audio --native)
expected_extension=".ogg"
if command -v ffmpeg >/dev/null 2>&1; then
  mode_args=(--mp3 -q 128K)
  expected_extension=".mp3"
fi

result="$(
  "$smoke_root/prefix/bin/lyt" \
    "${mode_args[@]}" \
    --no-history \
    --json \
    --max-filesize 1M \
    -o "$smoke_root/out" \
    "https://commons.wikimedia.org/wiki/File:Short_Silent,_Empty_Audio.ogg"
)"

printf '%s\n' "$result"
LYT_SMOKE_RESULT="$result" LYT_SMOKE_EXTENSION="$expected_extension" node -e '
  const fs = require("node:fs");
  const result = JSON.parse(process.env.LYT_SMOKE_RESULT);
  const files = result.results?.[0]?.files ?? [];
  if (!result.ok || result.schema !== "lyt.result.v1" || files.length < 1) process.exit(1);
  if (!files.every((file) => fs.existsSync(file))) process.exit(1);
  if (!files.every((file) => file.endsWith(process.env.LYT_SMOKE_EXTENSION))) process.exit(1);
  console.log("PACKED_LIVE_LINUX_OK");
'
