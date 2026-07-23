# lyt roadmap

The core product stays lightweight: one local CLI, one tested download engine,
and predictable machine-readable results. New capabilities should extend that
engine rather than duplicate it.

## Delivered for v0.8 review

- Read-only search powered by yt-dlp rather than a separate YouTube API:

  ```sh
  lyt search "query"
  lyt search "query" --limit 10 --json
  ```

  Search returns bounded, stable result fields. Downloading a selected result
  remains a separate explicit action.
- `lyt inspect` and `lyt plan` expose metadata, formats, effective output,
  required tools, size estimates when available, history matches, and planned
  side effects without downloading media or installing tools.
- Publisher-provided subtitles and separately explicit generated captions.
- Optional local artifact receipts with ffprobe metadata and SHA-256
  verification.
- Structured JSONL progress events, job IDs, exact artifact events, and a Tauri
  prototype that calls the canonical lyt sidecar with cancel/retry UI.

## Next - release hardening

- Exercise the sidecar against packaged desktop builds on all target platforms.
- Persist desktop job status across app restarts.
- Add resumable status queries beyond yt-dlp's existing partial-file behavior.
- Build standalone lyt binaries with no Node installation requirement.
- Add signed/notarized desktop installers and an updater strategy.
- Revisit MCP only as a thin adapter over the same CLI contract.

## Optional engines and libraries

Keep the core npm package dependency-free unless a library removes substantial
maintenance or security risk.

### Good optional integrations

- **ffprobe** - inspect downloaded artifacts and verify metadata. It already
  ships with many ffmpeg distributions and requires no npm dependency.
- **aria2c** - optional high-throughput external downloader. lyt already exposes
  yt-dlp's external-downloader hooks.
- **gallery-dl** - possible future optional adapter for permitted image and
  gallery workflows. Keep it outside the default video/audio install.
- **SponsorBlock API** - possible opt-in recipe for user-owned or permitted
  media, never a silent default.

### Libraries not recommended for the core today

- `youtubei.js`: powerful but unofficial, comparatively large, and another
  rapidly changing protocol surface when yt-dlp already provides search.
- Transcript/scraping packages: site-fragile and unnecessary while yt-dlp can
  expose official subtitles and captions.
- Process wrappers such as `execa`: convenient, but the current small spawn
  layer is tested and preserves the zero-npm-dependency advantage.
- Heavy schema libraries: JSON Schema and focused validation are sufficient for
  the current result contracts.

## Product boundary

lyt should be the local media execution layer - not a hosted downloader, cloud
library, streaming client, DRM bypass, or replacement for yt-dlp's complete
advanced interface.
