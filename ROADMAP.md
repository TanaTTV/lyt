# lyt roadmap

The core product stays lightweight: one local CLI, one tested download engine,
and predictable machine-readable results. New capabilities should extend that
engine rather than duplicate it.

## Now — v0.7.2 stabilization

- Variant-aware history and duplicate prevention.
- Strict JSON stdout behavior.
- Safer managed tool downloads.
- Capability-aware diagnostics.
- Accurate install and website claims.
- Cross-platform tests and repository documentation.

## Next — v0.8 search and discovery

### CLI search

Add a lightweight command powered by yt-dlp's existing search support rather
than a separate YouTube API dependency:

```sh
lyt search "query"
lyt search "query" --limit 10 --json
lyt search "query" --audio
lyt search "query" --video -q 1080p
```

The default search command should only return results. Downloading a selected
result must be a separate explicit action so agents and people can inspect what
will happen first.

Proposed result fields:

- extractor and media ID;
- title, channel, duration, and canonical URL;
- thumbnail URL;
- live/upcoming status when reported;
- selection index for interactive use.

### Inspect and plan

```sh
lyt inspect "URL" --json
lyt plan --video -q 1080p "URL" --json
lyt capabilities --json
```

These commands should expose metadata, available formats, effective config,
required tools, output location, estimated size when available, history match,
and planned side effects without downloading media.

### Artifact receipts

Return optional size, MIME type, container, duration, and tool versions for each
final artifact. Use ffprobe when available rather than introducing a large npm
media parser.

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
