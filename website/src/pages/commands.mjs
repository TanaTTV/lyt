import { escapeHtml, renderFaq } from "../components.mjs";

// Every flag and command below comes from `node bin/lyt.js --help` and
// `node bin/lyt.js capabilities --json`. Do not add flags that the CLI does not ship.
const groups = [
  {
    id: "audio-mp3",
    title: "Audio &amp; MP3",
    intro: "Download audio, convert it to MP3, and set the bitrate or loudness.",
    recipes: [
      ['lyt "https://www.youtube.com/watch?v=..."', "Download the audio stream. This is the default mode; --native keeps the native stream explicitly."],
      ['lyt --mp3 -q 192K "https://www.youtube.com/watch?v=..."', "Convert the audio to MP3 at a fixed 192K bitrate. Also accepts 128K or 320K."],
      ['lyt --mp3 -q 0 "https://www.youtube.com/watch?v=..."', "Convert to MP3 at the best variable bitrate. VBR levels run from 0 (best) to 10."],
      ['lyt --normalize "https://www.youtube.com/watch?v=..."', "Loudness-normalize to EBU R128. Implies --mp3."],
      ['lyt --profile music "https://www.youtube.com/watch?v=..."', "Apply a preset bundle. The presets are music, podcast, and voice."],
      ['yt3 "https://www.youtube.com/watch?v=..."', "Short alias for lyt with audio defaults."],
    ],
  },
  {
    id: "video-quality",
    title: "Video &amp; quality",
    intro: "Choose a resolution for video downloads. Video is muxed to mp4.",
    recipes: [
      ['lyt --video -q 1080p "URL"', "Download video at 1080p, with the best audio, muxed to mp4."],
      ['lyt --video -q 4k "URL"', "Request 4k video. Also accepts 720p, 8k, or best."],
      ['lyt --video --max-height 720p "URL"', "Cap the video resolution. Alias of -q in video mode."],
      ['lyt -L "URL"', "List the qualities available for each URL, then exit without downloading."],
      ['lyt --video --embed-metadata --embed-thumbnail "URL"', "Embed metadata and the thumbnail in the file. This may add time."],
      ['yt4 "URL"', "Short alias for lyt with video defaults."],
    ],
  },
  {
    id: "clips-chapters",
    title: "Clips &amp; chapters",
    intro: "Cut one section, several slices, or one file per chapter.",
    recipes: [
      ['lyt --clip 1:10-2:45 "URL"', "Download only the section from 1:10 to 2:45."],
      ['lyt --clip 1:10- "URL"', "Download from 1:10 to the end of the video."],
      ['lyt --clip -2:45 "URL"', "Download from the start of the video to 2:45."],
      ['lyt --clip 90-180 "URL"', "Plain seconds work too: 90 to 180 seconds."],
      ['lyt --clip 0:30-1:00 --clip 5:00-5:20 "URL"', "Repeat --clip to save several slices."],
      ['lyt --split-chapters "URL"', "Save one file per chapter, named by chapter."],
    ],
  },
  {
    id: "playlists-spotify",
    title: "Playlists, channels &amp; Spotify",
    intro: "Playlists are opt-in. Spotify tracks are matched on YouTube and saved as MP3 files.",
    recipes: [
      ['lyt --playlist "URL"', "Allow a playlist, channel, set, or profile. Files go into a numbered folder."],
      ['lyt --no-playlist "URL"', "Download only the single video, even when the URL points into a playlist. This is the default."],
      ['lyt "https://open.spotify.com/playlist/..."', "Save each track as an MP3 matched on YouTube, with tags and cover art. Albums, tracks, and artists also work."],
      ['lyt --sync "https://open.spotify.com/playlist/..."', "Renumber saved songs to the current order and move removed songs to a removed folder."],
      ['lyt config set spotify-client-id <id>', "Set Spotify API keys for playlists over 100 songs. Also set spotify-client-secret."],
      ["lyt --batch-file urls.txt", "Read URLs from a file, one per line. Use - to read from stdin."],
      ["lyt -j 4 --batch-file urls.txt", "Download up to 4 URLs in parallel."],
      ["lyt --paste", "Add the media URL from the clipboard."],
      ["lyt --watch", "Watch the clipboard and download each link you copy."],
    ],
  },
  {
    id: "subtitles-sponsorblock",
    title: "Subtitles &amp; SponsorBlock",
    intro: "Subtitles are saved as .srt files. SponsorBlock cuts sponsor and self-promotion segments.",
    recipes: [
      ['lyt --subs "URL"', "Save subtitles as .srt. Manual subtitles are used first, then automatic ones."],
      ['lyt --sub-langs "en.*,de" "URL"', "Choose subtitle languages. The default is en. Implies --subs."],
      ['lyt --video --subs --embed-subs "URL"', "Embed the subtitles in the video file. Video mode only."],
      ['lyt --no-subs "URL"', "Turn off subtitles that your config turns on."],
      ['lyt --sponsorblock "URL"', "Cut sponsor, self-promo, and interaction segments."],
      ['lyt --no-sponsorblock "URL"', "Turn off SponsorBlock that your config turns on."],
    ],
  },
  {
    id: "safety-output",
    title: "Safety &amp; output",
    intro: "Preview first, cap file sizes, and choose where files go. Existing files are never overwritten unless you ask.",
    recipes: [
      ['lyt --dry-run "URL"', "Print the commands without running them."],
      ['lyt --print-command "URL"', "Print an inert yt-dlp argv preview before the run starts."],
      ['lyt --max-filesize 2G "URL"', "Skip media larger than 2G."],
      ['lyt -o ./podcasts "URL"', "Save into a different output directory. The default is downloads."],
      ['lyt --template "%(title)s.%(ext)s" "URL"', "Set a custom yt-dlp output template."],
      ['lyt --force-overwrite "URL"', "Replace an existing file. Opt-in only."],
      ['lyt --redownload "URL"', "Download again even when the video is already in history."],
      ['lyt --no-history "URL"', "Skip recording this run in the download history."],
      ['lyt -r 2M "URL"', "Cap the download speed at 2M. --limit-rate does the same."],
      ['lyt --retries 5 "URL"', "Retry downloads and fragments up to 5 times. Accepts 0 to 100."],
      ['lyt --downloader aria2c --downloader-args "-x16 -s16 -k1M" "URL"', "Use aria2c as the external downloader. Useful on throttled hosts."],
      ['lyt --no-part "URL"', "Write straight to the output file instead of a .part file."],
      ['lyt --cookies-from-browser chrome "URL"', "Use your browser cookies for media your own account can access. Opt-in."],
      ['lyt --cookies cookies.txt "URL"', "Use a Netscape-format cookies file. Opt-in."],
      ['lyt --no-download "URL"', "Require yt-dlp and ffmpeg on PATH and skip the managed install."],
    ],
  },
  {
    id: "agents-json",
    title: "Agents &amp; JSON",
    intro: "Machine-readable output for terminal agents. Diagnostics go to stderr. Exit codes: 0 success, 1 runtime or download failure, 2 usage or validation error.",
    recipes: [
      ['lyt --json "URL"', "Emit one lyt.result.v1 document on stdout, with the final file paths."],
      ["lyt capabilities --json", "List commands, modes, flags, and result schemas as lyt.capabilities.v1."],
      ['lyt info "URL"', "Show media metadata and formats without downloading. Alias: lyt inspect."],
      ['lyt info --json "URL"', "Emit the same inspection as lyt.info.v1 JSON."],
      ['lyt info --jobs 8 --json "URL"', "Inspect with 8 workers. Accepts 1 to 16; the default is 3."],
      ["lyt agent install all", "Install the lyt skill for both Codex and Claude Code."],
      ["lyt agent install claude", "Install the lyt skill for Claude Code only."],
      ["lyt agent install codex --home <dir>", "Install the skill into a custom home directory."],
    ],
  },
  {
    id: "setup-maintenance",
    title: "Setup &amp; maintenance",
    intro: "Check the environment, store persistent defaults, and review download history.",
    recipes: [
      ["lyt doctor", "Check the environment."],
      ["lyt doctor --fix", "Install missing tools."],
      ["lyt doctor --update", "Self-update yt-dlp."],
      ["lyt doctor --network", "Check that YouTube, Spotify, SoundCloud, and GitHub are reachable."],
      ['lyt -i "URL"', "Prompt for options interactively."],
      ["lyt config list", "Show the persistent defaults."],
      ["lyt config set update-check false", "Turn off the npm update check."],
      ["lyt config path", "Show where the config file lives."],
      ["lyt history", "List past downloads."],
      ['lyt history "query"', "Search past downloads."],
      ["lyt history --clear", "Wipe the download history."],
      ["lyt --version", "Show the version and any update hint."],
    ],
  },
];

const recipeHtml = ([command, what]) => `
          <div class="recipe">
            <code>${escapeHtml(command)}</code>
            <small>${escapeHtml(what)}</small>
            <button class="copy" type="button" data-copy="${escapeHtml(command)}"><span class="copy-label">Copy</span></button>
          </div>`;

const groupHtml = (group) => `
        <section class="ref-group" id="${group.id}">
          <h2>${group.title}</h2>
          <p>${escapeHtml(group.intro)}</p>${group.recipes.map(recipeHtml).join("")}
        </section>`;

const navHtml = groups.map((group) => `
        <a href="#${group.id}">${group.title}</a>`).join("");

export const faq = [
  {
    q: "How do I download a YouTube video as MP3 from the command line?",
    a: "Run lyt --mp3 -q 192K with the video URL in quotes. lyt fetches the audio with yt-dlp, converts it to MP3 with ffmpeg at 192K, and saves the file in the downloads folder. Use -q 320K for a fixed high bitrate, or -q 0 for the best variable bitrate.",
  },
  {
    q: "What does lyt --json return to an AI agent?",
    a: "With --json, lyt writes one lyt.result.v1 JSON document to stdout, including the final file paths. Diagnostics go to stderr. Run lyt capabilities --json to read the commands, modes, flags, and exit codes as lyt.capabilities.v1.",
  },
  {
    q: "Can I download only part of a YouTube video?",
    a: "Yes. Use --clip with a start and end, such as --clip 1:10-2:45. Leave one side open with 1:10- for the rest of the video or -2:45 from the start. Repeat --clip for several slices, or use --split-chapters to save one file per chapter.",
  },
  {
    q: "Does lyt download Spotify audio directly?",
    a: "No. For a Spotify playlist, album, track, or artist, lyt reads the item and matches each track on YouTube, then saves it as an MP3 with tags and cover art. Re-run the same playlist to fetch only songs added since the last run. Playlists over 100 songs need Spotify API keys.",
  },
];

export const commands = {
  slug: "commands",
  nav: "Commands",
  title: "lyt commands: yt-dlp MP3, video and clip recipes",
  description: "Searchable lyt command reference: download YouTube as MP3 from the command line, clips, playlists, subtitles, and every --json flag for agents.",
  faq,
  body: `
    <main id="main" class="section shell">
      <div class="kicker">Command reference</div>
      <h1>Every lyt command, <span class="grad-text">ready to copy.</span></h1>
      <p class="lede">The yt-dlp jobs people search for most, from YouTube to MP3 to 1080p video and clips, as one-line lyt commands grouped by task. Search, copy, run. Use lyt only for media you own, have permission or a licence to download, public-domain media, or where an applicable exception applies.</p>

      <div class="ref-layout">
        <nav class="ref-nav" aria-label="Command groups">
          <label class="sr-only" for="ref-search">Search commands</label>
          <input id="ref-search" class="ref-search" type="search" data-ref-search placeholder="Search flags, e.g. mp3 or clip" autocomplete="off">
          <div class="ref-links">${navHtml}
          </div>
        </nav>

        <div>${groups.map(groupHtml).join("")}
          <p class="no-results">No commands match that search.</p>
          <p class="legal-note">lyt does not bypass DRM, paywalls, or access controls. Check the rights for any media before you download it.</p>
        </div>
      </div>

      ${renderFaq(faq)}
    </main>`,
};
