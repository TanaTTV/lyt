import { renderFaq } from "../components.mjs";

const installCommand = "npm install --global @tanattv/lyt";

const checkIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 8.5 2.5 2.5L12 5.5"/></svg>`;

// Terminal panels. Lines are joined with no whitespace between them because
// .ln is display:block inside a white-space:pre block.
const agentLines = [
  `<span class="ln"><span class="t-violet"># Claude Code: "Save the audio from this link as an MP3 and give me the path."</span></span>`,
  `<span class="ln cmd"><span class="t-muted">$ </span>lyt --mp3 -q 192K --json "URL"</span>`,
  `<span class="ln gap"></span>`,
  `<span class="ln"><span class="t-ok">{"ok":true,"status":"downloaded","files":["C:\\\\Downloads\\\\Example.mp3"]}</span></span>`,
].join("");

const videoLines = [
  `<span class="ln cmd"><span class="t-muted">$ </span>lyt --video -q 1080p "URL"</span>`,
  `<span class="ln"><span class="t-blue">Downloading</span> <span class="t-bar"></span> 1080p</span>`,
  `<span class="ln gap"></span>`,
  `<span class="ln"><span class="t-ok">Saved:</span> C:\\Users\\you\\Downloads\\Example.mp4</span>`,
].join("");

const clipLines = [
  `<span class="ln cmd"><span class="t-muted">$ </span>lyt --video --clip 1:10-2:45 "URL"</span>`,
  `<span class="ln"><span class="t-muted">Clip 1:10 to 2:45 (1:35)</span></span>`,
  `<span class="ln"><span class="t-blue">Downloading</span> <span class="t-bar"></span></span>`,
  `<span class="ln gap"></span>`,
  `<span class="ln"><span class="t-ok">Saved:</span> C:\\Users\\you\\Downloads\\Example.mp4</span>`,
].join("");

const jsonLines = [
  `{`,
  `  "schema": "lyt.result.v1",`,
  `  "ok": true,`,
  `  "results": [`,
  `    {`,
  `      "status": "downloaded",`,
  `      "files": ["C:\\\\Downloads\\\\Example.mp3"]`,
  `    }`,
  `  ]`,
  `}`,
].join("\n");

const agentMiniLines = [
  `{`,
  `  "schema": "lyt.result.v1",`,
  `  "ok": true,`,
  `  "results": [{ "status": "downloaded", "files": ["C:\\\\Downloads\\\\Example.mp3"] }]`,
  `}`,
].join("\n");

const doctorMiniLines = [
  `$ lyt doctor`,
  `core       ready`,
  `yt-dlp     checksum verified`,
  `ffmpeg     needed for MP3 and video`,
  `$ lyt doctor --fix`,
].join("\n");

const playlistTracks = [
  `<div class="track"><span class="num">01</span><span class="art" style="--art:linear-gradient(135deg,#ff2a4a,#ffb547)"></span><span class="name"><b>Song One</b><small>Artist</small></span><span class="badge ok">saved</span></div>`,
  `<div class="track"><span class="num">02</span><span class="art" style="--art:linear-gradient(135deg,#7cc4ff,#b69cff)"></span><span class="name"><b>Song Two</b><small>Artist</small></span><span class="badge new">new</span></div>`,
  `<div class="track"><span class="num">03</span><span class="art" style="--art:linear-gradient(135deg,#4ade80,#7cc4ff)"></span><span class="name"><b>Song Three</b><small>Artist</small></span><span class="badge skip">exists</span></div>`,
].join("");

const iconPaths = {
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  text: '<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>',
  scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8.2 8.4 20 18M8.2 15.6 20 6"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;

const useCases = [
  ["bot", "Give your AI agent a download tool", "Claude Code or Codex runs lyt, reads the JSON, and tells you where the file landed. No log scraping, no guessing.", 'lyt --mp3 --json "URL"'],
  ["archive", "Back up your own uploads", "Keep local copies of your videos and podcasts at the quality you want, a whole channel at a time with <code>--playlist</code>.", 'lyt --video -q 4k --playlist "URL"'],
  ["text", "Feed transcripts to your agent", "Save subtitles as <code>.srt</code> next to the media, so your agent can read, summarize, or quote your talk or lecture.", 'lyt --subs --sub-langs en "URL"'],
  ["scissors", "Clip the part you need", "Pull a single segment for an edit, a lesson, or a reply, without downloading the whole video first.", 'lyt --video --clip 1:10-2:45 "URL"'],
  ["music", "Turn playlists into a library", "Spotify playlists become tagged MP3s matched on YouTube, in order. Re-run to fetch only the new songs.", 'lyt "https://open.spotify.com/playlist/..."'],
  ["terminal", "Script it", "Read URLs from a file, run jobs in parallel, and parse one result document in CI or a cron job.", "lyt -a urls.txt -j 3 --json"],
].map(([name, title, text, command]) => `
          <article class="use">
            <span class="use-icon" aria-hidden="true">${icon(name)}</span>
            <h3>${title}</h3>
            <p>${text}</p>
            <code>${command.replaceAll('"', "&quot;")}</code>
          </article>`).join("");

const guides = [
  ["codex-audio/", "Codex", "Download YouTube audio as MP3 with Codex"],
  ["claude-video/", "Claude Code", "Download YouTube videos with Claude Code"],
  ["agent-clips/", "Any agent", "Extract a video clip with an AI coding agent"],
  ["commands/", "Reference", "Every lyt command, ready to copy"],
  ["windows/", "Windows", "Easy yt-dlp setup on Windows"],
  ["ai/", "For AI", "lyt fact sheet for AI assistants"],
].map(([href, tag, title]) => `
          <a class="guide" href="${href}"><span>${tag}</span><b>${title}</b><i aria-hidden="true">→</i></a>`).join("");

const faq = [
  {
    q: "Can Claude Code download YouTube audio?",
    a: "Yes, when you are allowed to download the media. Install lyt, then run lyt agent install claude so Claude Code loads the lyt skill. The agent can then run lyt --mp3 -q 192K --json and read the saved file path from the JSON result."
  },
  {
    q: "Is lyt a replacement for yt-dlp?",
    a: "No. lyt uses yt-dlp and ffmpeg underneath and gives them a smaller interface with safe defaults, guided setup, and JSON results. For advanced extractor options, run yt-dlp directly."
  },
  {
    q: "Is lyt free?",
    a: "Yes. lyt is free and MIT licensed. It has no lyt account and no hosted service, and the npm package has zero runtime dependencies."
  },
  {
    q: "Does lyt work on Windows?",
    a: "Yes. lyt runs on Windows, macOS, and Linux with Node.js 20 or newer. On Windows, lyt can provision a verified ffmpeg build. On macOS and Linux, lyt doctor shows the package-manager command to install ffmpeg."
  },
  {
    q: "Can lyt turn a Spotify playlist into MP3s?",
    a: "Yes, for public Spotify playlists. lyt reads the public track list, finds each song on YouTube, and saves tagged MP3s in playlist order. lyt never downloads Spotify audio itself. Playlists over 100 songs need optional Spotify API keys to read the full list."
  },
  {
    q: "Is it legal to download YouTube videos with lyt?",
    a: "It depends on the media and your location. Download only when you own it, have permission or a license, the work is in the public domain, or an applicable copyright exception allows it. Public availability alone does not grant download rights. lyt does not bypass DRM, paywalls, or access controls. This is not legal advice."
  },
  {
    q: "How do I let an AI agent download YouTube videos?",
    a: "Install lyt with npm install --global @tanattv/lyt, then run lyt agent install claude or lyt agent install codex. Ask your agent for the file in plain language. It runs lyt with --json and reports the exact saved path. Download only media you have the rights to."
  },
  {
    q: "Does lyt work with Cursor, Gemini CLI, or other AI agents?",
    a: "Yes, if the agent can run terminal commands. Codex and Claude Code can install the lyt skill. Other agents, such as Gemini CLI or Cursor's agent, run the installed lyt command and read the --json result."
  },
  {
    q: "Does lyt give AI agents JSON output?",
    a: "Yes. With --json, lyt writes one lyt.result.v1 document to stdout with the exact final file paths, and progress and setup diagnostics go to stderr. lyt capabilities --json lists the commands, flags, and result schemas."
  }
];

export const home = {
  slug: "",
  title: "lyt — yt-dlp for AI agents like Claude Code and Codex",
  description: "Free yt-dlp CLI and agent skill. Let Claude Code, Codex, or any terminal AI agent save permitted YouTube audio and video and get the exact file path as JSON.",
  faq,
  body: `
    <main id="main">
      <section class="hero shell">
        <div class="hero-grid">
          <div class="hero-copy">
            <a class="release-pill" href="https://github.com/TanaTTV/lyt/releases"><b>v0.8.2</b> Spotify, subtitles, SponsorBlock <span class="arrow">→</span></a>
            <h1>Media downloads<br><span class="grad-text">your AI agent can trust.</span></h1>
            <p class="lede">lyt is a free yt-dlp CLI and agent skill. Ask Claude Code, Codex, or any terminal agent to save permitted audio or video. lyt handles the setup, keeps risky options off, and hands back the exact file path as JSON.</p>
            <div class="actions">
              <a class="button primary" href="install/">Install lyt</a>
              <a class="button secondary" href="agents/">Set up your agent</a>
            </div>
            <div class="install-box">
              <code><span class="prompt">$</span>${installCommand}</code>
              <button class="copy" type="button" data-copy="${installCommand}"><span class="copy-label">Copy</span></button>
            </div>
            <div class="hero-meta">
              <span>${checkIcon}Free &amp; MIT</span>
              <span>${checkIcon}Windows, macOS, Linux</span>
              <span>${checkIcon}Node.js 20+</span>
            </div>
            <p class="legal-note">Use lyt only for media you own, have permission or a license for, that is in the public domain, or where an applicable copyright exception allows it. No DRM, paywall, or access-control bypass.</p>
          </div>
          <div class="terminal" data-terminal>
            <div class="terminal-bar">
              <div class="dots"><i></i><i></i><i></i></div>
              <div class="tabs" role="tablist" aria-label="Example lyt runs">
                <button class="tab" type="button" role="tab" id="tab-agent" aria-selected="true" aria-controls="panel-agent" tabindex="0">agent</button>
                <button class="tab" type="button" role="tab" id="tab-video" aria-selected="false" aria-controls="panel-video" tabindex="-1">video</button>
                <button class="tab" type="button" role="tab" id="tab-clip" aria-selected="false" aria-controls="panel-clip" tabindex="-1">clip</button>
              </div>
            </div>
            <div role="tabpanel" id="panel-agent" aria-labelledby="tab-agent"><pre><code>${agentLines}</code></pre></div>
            <div role="tabpanel" id="panel-video" aria-labelledby="tab-video" hidden><pre><code>${videoLines}</code></pre></div>
            <div role="tabpanel" id="panel-clip" aria-labelledby="tab-clip" hidden><pre><code>${clipLines}</code></pre></div>
          </div>
        </div>
      </section>

      <section class="sites shell">
        <p>Works with</p>
        <div class="site-row">
          <span class="site-chip"><i style="--c:#ff3b3b"></i>YouTube</span>
          <span class="site-chip"><i style="--c:#1ed760"></i>Spotify playlists</span>
          <span class="site-chip"><i style="--c:#ff7a1a"></i>SoundCloud</span>
          <span class="site-chip"><i style="--c:#1ab7ea"></i>Vimeo</span>
          <span class="site-chip"><i style="--c:#1da0c3"></i>Bandcamp</span>
          <span class="site-chip more">and anything yt-dlp supports</span>
        </div>
      </section>

      <section class="section shell reveal">
        <div class="section-head">
          <div class="kicker">Why lyt</div>
          <h2>The yt-dlp CLI built for AI agents, and still pleasant for people.</h2>
          <p>Agent-native output, safe defaults, and setup that checks itself.</p>
        </div>
        <div class="bento">
          <article class="card feature span-4">
            <span class="tag">Agent-native</span>
            <h3>Built for AI agents</h3>
            <p>lyt writes one stable <code>lyt.result.v1</code> JSON document to stdout, with progress and diagnostics on stderr. Agents get exact file paths instead of scraping terminal text.</p>
            <div class="visual"><div class="mini">${agentMiniLines}</div></div>
          </article>
          <article class="card span-2">
            <span class="tag">Safe defaults</span>
            <h3>Safe by default</h3>
            <p>One item at a time. Playlists need <code>--playlist</code>, existing files are kept unless you add <code>--force-overwrite</code>, and <code>--max-filesize</code> and <code>--dry-run</code> add guards.</p>
          </article>
          <article class="card span-3">
            <span class="tag">Spotify</span>
            <h3>Spotify playlists → MP3</h3>
            <p>Each public track is matched on YouTube and saved as a tagged MP3 in playlist order. lyt never downloads Spotify audio. Songs already on disk are skipped.</p>
            <div class="visual">
              <div class="playlist">${playlistTracks}</div>
              <div class="file-line">downloads/My Playlist/01 - Artist - Song One.mp3</div>
            </div>
          </article>
          <article class="card span-3">
            <span class="tag">Clips</span>
            <h3>Clips and chapters</h3>
            <p>Save one section with <code>--clip 1:10-2:45</code>, repeat <code>--clip</code> for several, or split a download into one file per chapter with <code>--split-chapters</code>.</p>
            <div class="visual">
              <div class="timeline"><span class="sel"></span></div>
              <div class="timeline-labels"><span>0:00</span><b>1:10 to 2:45</b><span>end</span></div>
            </div>
          </article>
          <article class="card span-2">
            <span class="tag">Cleaner videos</span>
            <h3>SponsorBlock</h3>
            <p><code>--sponsorblock</code> cuts sponsor, self-promo, and interaction segments. Subtitles are a flag away with <code>--subs</code>.</p>
            <div class="visual">
              <div class="segbar"><i style="--w:3"></i><i class="cut" style="--w:1"></i><i style="--w:4"></i><i class="cut" style="--w:1"></i><i style="--w:5"></i></div>
              <div class="seg-legend"><span>Kept</span><span class="cut">Cut</span></div>
            </div>
          </article>
          <article class="card span-4">
            <span class="tag">Zero-fuss setup</span>
            <h3>Setup that checks itself</h3>
            <p>lyt provisions a checksum-verified yt-dlp, provisions a verified ffmpeg on Windows, and on macOS and Linux tells you the exact command to run. <code>lyt doctor</code> reports what is ready.</p>
            <div class="visual"><div class="mini">${doctorMiniLines}</div></div>
          </article>
        </div>
      </section>

      <section class="section shell reveal" id="use-cases">
        <div class="section-head">
          <div class="kicker">Use cases</div>
          <h2>What people hand to lyt.</h2>
          <p>One job, one command, one file path back. These are the jobs lyt does most.</p>
        </div>
        <div class="use-grid">${useCases}
        </div>
      </section>

      <section class="section shell reveal">
        <div class="section-head">
          <div class="kicker">How it works</div>
          <h2>Three steps to your first permitted file.</h2>
        </div>
        <ol class="steps">
          <li class="step">
            <h3>Install</h3>
            <p>Install the CLI. Requires Node.js 20 or newer.</p>
            <div class="cmd"><code>${installCommand}</code><button class="copy" type="button" data-copy="${installCommand}"><span class="copy-label">Copy</span></button></div>
          </li>
          <li class="step">
            <h3>Check</h3>
            <p>See what is ready and what still needs a fix.</p>
            <div class="cmd"><code>lyt doctor</code><button class="copy" type="button" data-copy="lyt doctor"><span class="copy-label">Copy</span></button></div>
          </li>
          <li class="step">
            <h3>Ask your agent or run it</h3>
            <p>Install the skill for Claude Code or Codex, then ask your agent for the file. Or run lyt yourself.</p>
            <div class="cmd"><code>lyt agent install claude</code><button class="copy" type="button" data-copy="lyt agent install claude"><span class="copy-label">Copy</span></button></div>
          </li>
        </ol>
      </section>

      <section class="section shell reveal">
        <div class="agent-band">
          <div class="agent-grid">
            <div>
              <div class="kicker">For agents</div>
              <h2>Your agent gets a file path, not a wall of logs.</h2>
              <p>lyt writes one <code>lyt.result.v1</code> document to stdout. Progress and setup diagnostics go to stderr, so agents never have to scrape terminal text.</p>
              <ul class="check-list">
                <li>Exact final file paths in <code>results[].files</code></li>
                <li>Clear skip reasons such as <code>history</code> or <code>max-filesize</code></li>
                <li>Playlists and overwrites need explicit flags</li>
                <li><code>lyt capabilities --json</code> lists commands, flags, and exit codes</li>
              </ul>
              <div class="agent-logos">
                <span>Claude Code</span>
                <span>Codex</span>
                <span>Gemini CLI</span>
                <span>Cursor</span>
                <span>Any agent with a shell</span>
              </div>
              <a class="text-link" href="agents/">Read the agent guide →</a>
            </div>
            <pre class="json"><code>${jsonLines}</code></pre>
          </div>
        </div>
      </section>

      <section class="section shell reveal" id="guides">
        <div class="section-head">
          <div class="kicker">Guides</div>
          <h2>Step-by-step guides for agents and people.</h2>
        </div>
        <div class="guide-grid">${guides}
        </div>
      </section>

      <section class="section shell reveal">
        <div class="section-head">
          <div class="kicker">Compared with yt-dlp</div>
          <h2>Simpler where you want guardrails. yt-dlp where you need every option.</h2>
        </div>
        <div class="compare-wrap">
          <table class="compare-table">
            <thead>
              <tr><th scope="col">Task</th><th scope="col">yt-dlp alone</th><th scope="col" class="us">lyt</th></tr>
            </thead>
            <tbody>
              <tr><td>Setup</td><td>Install yt-dlp and ffmpeg yourself and keep them updated</td><td class="us">npm install, then <code>lyt doctor</code>; yt-dlp is provisioned and checksum-verified</td></tr>
              <tr><td>Playlists by default</td><td>Playlist links download every item unless you pass <code>--no-playlist</code></td><td class="us">One item unless you pass <code>--playlist</code></td></tr>
              <tr><td>Repeat downloads</td><td>Opt in to <code>--download-archive</code> to skip items you already have</td><td class="us">Local history skips repeats by default; <code>--redownload</code> bypasses it</td></tr>
              <tr><td>Machine-readable result</td><td>Assemble your own with <code>--print</code> or <code>-J</code></td><td class="us">One <code>lyt.result.v1</code> JSON document with exact files</td></tr>
              <tr><td>Advanced extractor options</td><td><span class="yes">yt-dlp wins:</span> its full option, format, and post-processing surface</td><td class="us"><span class="meh">Covers common options. Use yt-dlp directly for the rest.</span></td></tr>
            </tbody>
          </table>
        </div>
        <a class="text-link" href="yt-dlp-easy/">Read the full comparison →</a>
      </section>

      ${renderFaq(faq)}

      <section class="section shell reveal">
        <div class="cta">
          <img src="logo.svg" alt="" width="72" height="72">
          <h2>Install once. Ask for the file.</h2>
          <p>Install the CLI, run the doctor, then let your agent save one permitted file and return its exact path.</p>
          <div class="actions">
            <a class="button primary" href="install/">Install lyt</a>
            <a class="button secondary" href="agents/">Set up your agent</a>
          </div>
        </div>
      </section>
    </main>`
};
