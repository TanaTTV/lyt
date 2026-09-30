# lyt roadmap

The core product stays lightweight: one local CLI, one tested download engine,
and predictable machine-readable results. Extend the engine instead of duplicating it.

## Shipped - 0.8.0

- Clipboard downloads, profiles, clips, variant-aware history, and quiet update notices.
- `lyt info` / `lyt inspect` and `lyt capabilities` with versioned JSON.
- Agent guidance reuses existing authorization and separates local retrieval from publication clearance.
- Clean packed-install checks on Windows, macOS, and Linux.

## In progress - 0.9.0 agent media workflows

- `lyt search "query" --limit 5 --no-download --json` returns YouTube candidates;
  selecting a URL and downloading remain separate explicit actions.
- Actionable JSON errors retain numeric codes and add categories, retryability,
  and suggestions. Upstream errors are classified conservatively.
- Artifact receipts inspect actual final files, with optional ffprobe metadata
  and explicit verified/file-only/failed status.
- Search, result schemas, capabilities, skills, documentation, and package checks stay synchronized.

Tracking: #42 search, #44 receipts, #45 jobs, #46 desktop sidecar.

## Next - planning and recovery

- `lyt plan` (#43): effective configuration, required tools, output location,
  estimated size, history match, and planned side effects. Current dry runs only
  expose command planning; they are not a full metadata-aware plan.
- One authorized operation to update the CLI and refresh installed skills.
- Captions from yt-dlp's subtitle support without an additional scraping dependency.

## Later — shared GUI and agent execution layer

- Add structured JSONL progress events.
- Add job IDs, cancellation, retry, and resumable status.
- Build standalone lyt binaries with no Node installation requirement.
- Make the Tauri desktop app invoke the canonical lyt sidecar instead of
  independently generating yt-dlp arguments.
- Add signed/notarized desktop installers and an updater strategy.
- Revisit MCP only as a thin adapter over the same CLI contract.

## Optional engines and libraries

Keep the core npm package dependency-free unless a library removes substantial
maintenance or security risk.

### Good optional integrations

- **ffprobe** — inspect downloaded artifacts and verify metadata. Already ships
  with many ffmpeg distributions and requires no npm dependency.
- **aria2c** — optional high-throughput external downloader. lyt already exposes
  yt-dlp's external-downloader hooks.
- **gallery-dl** — possible future optional adapter for permitted image and
  gallery workflows. Keep it outside the default video/audio install.
- **SponsorBlock API** — possible opt-in recipe for user-owned or permitted
  media, never a silent default.

### Libraries not recommended for the core today

- `youtubei.js`: powerful but unofficial, comparatively large, and another
  rapidly changing protocol surface when yt-dlp already provides search.
- transcript/scraping packages: site-fragile and unnecessary while yt-dlp can
  expose official subtitles and captions.
- process wrappers such as `execa`: convenient, but the current small spawn
  layer is tested and preserves the zero-npm-dependency advantage.
- heavy schema libraries: JSON Schema and focused validation are sufficient for
  the current result contracts.

## Product boundary

lyt should be the local media execution layer—not a hosted downloader, cloud
library, streaming client, DRM bypass, or replacement for yt-dlp's complete
advanced interface.
