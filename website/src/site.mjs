export const pages = [
  {
    slug: "",
    nav: "Home",
    title: "lyt — local yt-dlp CLI for people and AI agents",
    description: "Download permitted audio or video locally with a friendlier yt-dlp CLI, safe defaults, automatic tools, and exact file results for humans, Codex, and Claude Code.",
    body: `
      <main id="main">
        <section class="hero shell">
          <div class="eyebrow"><span class="pulse"></span> Open source · local-first · agent-ready</div>
          <div class="hero-grid">
            <div>
              <h1>Local media.<br><span>Exact results.</span></h1>
              <p class="lede">lyt gives yt-dlp a smaller, safer interface for people, scripts, Codex, and Claude Code.</p>
              <div class="actions">
                <a class="button primary" href="install/">Install lyt</a>
                <a class="button secondary" href="https://github.com/TanaTTV/lyt">View on GitHub</a>
              </div>
              <p class="legal-note">Only download media you own or have permission to use.</p>
            </div>
            <div class="terminal-card" aria-label="lyt installation and example command">
              <div class="terminal-bar"><span></span><span></span><span></span><strong>Terminal</strong></div>
              <pre><code><span class="muted">$</span> npm install --global @tanattv/lyt
<span class="muted">$</span> lyt doctor
<span class="ok">✓</span> lyt is ready

<span class="muted">$</span> lyt --video -q 1080p <span class="red">"URL"</span>
<span class="ok">Saved:</span> C:\Users\you\Downloads\Example.mp4</code></pre>
              <button class="copy" data-copy="npm install --global @tanattv/lyt">Copy install command</button>
            </div>
          </div>
        </section>

        <section class="proof shell" aria-label="Product proof">
          <article><strong>One install</strong><span>yt-dlp and ffmpeg are found or fetched on first use.</span></article>
          <article><strong>Safe defaults</strong><span>No accidental playlists, overwrites, or hidden output paths.</span></article>
          <article><strong>Agent contract</strong><span>Versioned JSON on stdout; progress and setup on stderr.</span></article>
        </section>

        <section class="section shell split">
          <div>
            <div class="kicker">For people</div>
            <h2>Stop memorizing flags.</h2>
            <p>Use readable quality names, quick audio and video shortcuts, profiles, clips, chapters, history, and clipboard workflows.</p>
          </div>
          <div class="command-stack">
            <code>yt3 "URL" <span>native audio</span></code>
            <code>lyt --mp3 -q 192K "URL" <span>MP3</span></code>
            <code>yt4 -q 1080p "URL" <span>video</span></code>
            <code>lyt --clip 1:10-2:45 --mp3 "URL" <span>clip</span></code>
          </div>
        </section>

        <section class="section shell agent-panel">
          <div class="kicker">For agents</div>
          <h2>Give Codex and Claude a dependable local media tool.</h2>
          <p>lyt returns one stable JSON document with success state, safe failure reasons, and exact final file paths after conversion.</p>
          <div class="schema-grid">
            <pre><code>{
  "schema": "lyt.result.v1",
  "ok": true,
  "results": [{
    "status": "downloaded",
    "files": ["C:\\Downloads\\Example.mp3"]
  }]
}</code></pre>
            <div>
              <h3>Install the agent skill</h3>
              <code class="single-command">lyt agent install all</code>
              <ul class="check-list">
                <li>Exact paths instead of terminal scraping</li>
                <li>Explicit playlist and overwrite controls</li>
                <li>Machine-readable format inspection</li>
                <li>Meaningful exit codes and size guards</li>
              </ul>
              <a class="text-link" href="agents/">See the agent guide →</a>
            </div>
          </div>
        </section>

        <section class="section shell compare">
          <div>
            <div class="kicker">Built on the right foundation</div>
            <h2>yt-dlp power without pretending to replace yt-dlp.</h2>
          </div>
          <p>Use direct yt-dlp when you need its full advanced surface. Use lyt when setup, predictable safety, repeatable commands, and agent-friendly results matter more than exposing every flag.</p>
          <a class="text-link" href="yt-dlp-easy/">Read the honest comparison →</a>
        </section>

        <section class="final-cta shell">
          <img src="lyt-logo.png" alt="lyt red feather-bolt logo" width="104" height="104">
          <div><h2>Ready for the first file?</h2><p>Install lyt, run the doctor, and try one permitted media task.</p></div>
          <a class="button primary" href="install/">Get started</a>
        </section>
      </main>`
  },
  {
    slug: "install",
    nav: "Install",
    title: "Install lyt — friendly yt-dlp CLI for Windows, macOS, and Linux",
    description: "Install lyt from npm, verify yt-dlp and ffmpeg automatically, and download your first permitted audio or video file.",
    body: `
      <main id="main" class="doc shell">
        <div class="kicker">Install</div>
        <h1>From zero to a saved file.</h1>
        <p class="lede">lyt currently requires Node.js 20 or newer. The CLI finds or downloads yt-dlp and guides ffmpeg setup when required.</p>
        <section><h2>1. Install the CLI</h2><div class="code-block"><code>npm install --global @tanattv/lyt</code><button class="copy" data-copy="npm install --global @tanattv/lyt">Copy</button></div></section>
        <section><h2>2. Check the setup</h2><div class="code-block"><code>lyt doctor</code><button class="copy" data-copy="lyt doctor">Copy</button></div><p>The doctor reports the current lyt, yt-dlp, and ffmpeg state and gives an actionable repair when something is missing.</p></section>
        <section><h2>3. Download one permitted item</h2><div class="recipe-grid"><article><span>Native audio</span><code>lyt --audio "URL"</code></article><article><span>MP3 · 192K</span><code>lyt --mp3 -q 192K "URL"</code></article><article><span>Video · 1080p</span><code>lyt --video -q 1080p "URL"</code></article></div></section>
        <section class="callout"><h2>Where does the file go?</h2><p>By default, lyt saves to a <code>downloads</code> folder and prints the exact final path after conversion. Choose another location with <code>-o "D:/Media"</code>.</p></section>
        <section><h2>Common first-run fixes</h2><ul class="check-list"><li>Confirm <code>node --version</code> is 20 or newer.</li><li>Run <code>lyt doctor --fix</code> when the doctor recommends it.</li><li>Quote every URL so the shell does not interpret special characters.</li><li>Use <code>--dry-run</code> to preview a job safely.</li><li>Open a GitHub issue without sharing cookies, private URLs, or tokens.</li></ul></section>
        <div class="page-actions"><a class="button primary" href="https://www.npmjs.com/package/@tanattv/lyt">Open npm package</a><a class="button secondary" href="https://github.com/TanaTTV/lyt/issues">Get help</a></div>
      </main>`
  },
  {
    slug: "agents",
    nav: "Agents",
    title: "Use lyt with Codex and Claude Code",
    description: "Install the maintained lyt skills for Codex and Claude Code and use stable JSON with exact final file paths for safe local media tasks.",
    body: `
      <main id="main" class="doc shell">
        <div class="kicker">Codex + Claude Code</div>
        <h1>A local media capability agents can call reliably.</h1>
        <p class="lede">Agent workflows should not scrape animated progress or guess which post-processed filename exists. lyt separates machine output from human diagnostics.</p>
        <section><h2>1. Install the lyt CLI</h2><div class="code-block"><code>npm install --global @tanattv/lyt
lyt doctor</code><button class="copy" data-copy="npm install --global @tanattv/lyt&#10;lyt doctor">Copy</button></div></section>
        <section><h2>2. Add lyt to Codex</h2><div class="code-block"><code>codex plugin marketplace add TanaTTV/lyt
codex plugin add lyt@lyt-plugins</code><button class="copy" data-copy="codex plugin marketplace add TanaTTV/lyt&#10;codex plugin add lyt@lyt-plugins">Copy</button></div></section>
        <section><h2>Or add lyt to Claude Code</h2><div class="code-block"><code>claude plugin marketplace add TanaTTV/lyt
claude plugin install lyt@lyt-plugins</code><button class="copy" data-copy="claude plugin marketplace add TanaTTV/lyt&#10;claude plugin install lyt@lyt-plugins">Copy</button></div></section>
        <section><h2>Direct skill install</h2><p>If you do not want to configure a marketplace, use <code>lyt agent install all</code>, <code>lyt agent install codex</code>, or <code>lyt agent install claude</code>.</p></section>
        <section><h2>See the 30-second workflow</h2><p>The demo uses an original MIT-licensed source clip created for lyt, runs the real JSON workflow, and shows the exact path returned to the agent.</p><video controls preload="metadata" poster="../demo/lyt-agent-demo.png" style="width:100%;border-radius:1.25rem;border:1px solid rgba(255,31,61,.3);background:#08090d"><source src="../demo/lyt-agent-demo.mp4" type="video/mp4">Your browser does not support embedded video.</video></section>
        <section><h2>Use JSON for every agent job</h2><div class="recipe-grid"><article><span>Audio</span><code>lyt --audio --json "URL"</code></article><article><span>MP3 clip</span><code>lyt --clip 1:10-2:45 --mp3 --json "URL"</code></article><article><span>1080p with size guard</span><code>lyt --video -q 1080p --max-filesize 2G --json "URL"</code></article></div></section>
        <section class="callout"><h2>Output contract</h2><p>stdout contains one <code>lyt.result.v1</code> JSON document. Setup and progress go to stderr. After success, read <code>results[].files</code> and report those exact paths.</p></section>
        <section><h2>Safety behavior</h2><ul class="check-list"><li>Single-item mode is the default even when a playlist URL is detected.</li><li>Existing final files are preserved unless overwrite is explicitly requested.</li><li>Size limits fail safely with a structured reason.</li><li>History skips are explicit and can be overridden only when requested.</li><li>Permission to download remains a user decision; the skill does not bypass site restrictions.</li></ul></section>
        <section><h2>What the plugin teaches the agent</h2><p>The Codex and Claude packages use the same maintained skill. It prefers machine-readable output, reports exact final paths, keeps playlists and overwrites opt-in, and never treats a public URL as permission to download.</p></section>
        <div class="page-actions"><a class="button primary" href="https://github.com/TanaTTV/lyt/tree/main/plugins/lyt">Inspect the plugin</a><a class="button secondary" href="../install/">Install lyt first</a></div>
      </main>`
  },
  {
    slug: "windows",
    nav: "Windows",
    title: "Easy yt-dlp setup on Windows with lyt",
    description: "A beginner-friendly Windows path for installing a local yt-dlp CLI, checking ffmpeg, and saving permitted audio or video files.",
    body: `
      <main id="main" class="doc shell">
        <div class="kicker">Windows guide</div>
        <h1>Use yt-dlp on Windows without assembling the toolchain yourself.</h1>
        <p class="lede">lyt wraps the mature yt-dlp engine with automatic tool setup and memorable commands.</p>
        <section><h2>Install Node.js 20 or newer</h2><p>Download the current LTS release from the official Node.js website, then reopen PowerShell and verify:</p><div class="code-block"><code>node --version</code><button class="copy" data-copy="node --version">Copy</button></div></section>
        <section><h2>Install and check lyt</h2><div class="code-block"><code>npm install --global @tanattv/lyt
lyt doctor</code><button class="copy" data-copy="npm install --global @tanattv/lyt&#10;lyt doctor">Copy</button></div></section>
        <section><h2>Save a video to Downloads</h2><div class="code-block"><code>lyt --video -q 1080p -o "$HOME/Downloads" "URL"</code><button class="copy" data-copy="lyt --video -q 1080p -o &quot;$HOME/Downloads&quot; &quot;URL&quot;">Copy</button></div></section>
        <section class="callout"><h2>PowerShell tip</h2><p>Always put the URL in quotes. Characters such as <code>&amp;</code> can otherwise be interpreted by the shell instead of passed to lyt.</p></section>
        <section><h2>If PowerShell cannot find lyt</h2><ul class="check-list"><li>Close and reopen the terminal after installation.</li><li>Run <code>npm prefix --global</code> and confirm its executable directory is on PATH.</li><li>Run <code>npx --yes -p @tanattv/lyt lyt doctor</code> as a temporary diagnostic.</li><li>Include the exact error—not private URLs—when requesting help.</li></ul></section>
      </main>`
  },
  {
    slug: "yt-dlp-easy",
    nav: "Why lyt",
    title: "lyt vs yt-dlp — when a friendlier CLI helps",
    description: "An honest comparison of direct yt-dlp and lyt for local downloads, repeatable presets, safe defaults, and AI-agent automation.",
    body: `
      <main id="main" class="doc shell">
        <div class="kicker">Honest comparison</div>
        <h1>lyt does not replace yt-dlp. It packages a smaller workflow.</h1>
        <p class="lede">Both tools ultimately rely on the same powerful engine. The right choice depends on whether you want maximum surface area or a repeatable, safer default path.</p>
        <section><div class="comparison-table"><div class="row head"><span>Need</span><span>Direct yt-dlp</span><span>lyt</span></div><div class="row"><span>Every advanced extractor option</span><span>Best choice</span><span>Intentionally smaller</span></div><div class="row"><span>Automatic first-use tools</span><span>Manual/package-specific</span><span>Built in</span></div><div class="row"><span>Memorable MP3/video presets</span><span>Build the flags</span><span>Built in</span></div><div class="row"><span>Safe single-item default</span><span>Configure explicitly</span><span>Built in</span></div><div class="row"><span>Exact final paths for agents</span><span>Custom parsing/config</span><span>Versioned JSON</span></div><div class="row"><span>Large existing community</span><span>Yes</span><span>Early project</span></div></div></section>
        <section class="callout"><h2>Use direct yt-dlp when</h2><p>You already know the flags, need a feature lyt does not expose, or want to follow yt-dlp documentation exactly.</p></section>
        <section><h2>Use lyt when</h2><p>You want one setup path, predictable safety, reusable profiles, readable quality controls, or a stable result contract for Codex, Claude, and scripts.</p></section>
        <div class="page-actions"><a class="button primary" href="../install/">Try lyt</a><a class="button secondary" href="https://github.com/yt-dlp/yt-dlp">Use yt-dlp directly</a></div>
      </main>`
  },
  {
    slug: "privacy",
    nav: null,
    title: "lyt privacy and responsible-use notes",
    description: "How lyt handles local files, history, network requests, telemetry, and permission-first media downloads.",
    body: `
      <main id="main" class="doc shell">
        <div class="kicker">Trust</div>
        <h1>Local-first, not invisible.</h1>
        <p class="lede">lyt runs on your machine and does not include product analytics telemetry. Download requests still contact the media site and tool-release sources when dependencies are fetched.</p>
        <section><h2>Files and history</h2><p>Downloaded media and lyt history stay on the local machine unless the user moves or shares them. Output locations are controlled by the user.</p></section>
        <section><h2>Network behavior</h2><p>yt-dlp contacts the supplied media URL and related services needed to resolve streams. First-use setup may contact official release sources for managed tools. lyt cannot make those network requests anonymous.</p></section>
        <section><h2>Telemetry</h2><p>The current CLI does not send lyt product-usage analytics. Aggregate npm downloads and GitHub traffic are provided by those platforms and do not prove unique or successful users.</p></section>
        <section><h2>Responsible use</h2><p>Only download media you own or have permission to use. Public availability does not automatically grant download, reuse, or redistribution rights. Site terms and local law may also restrict a workflow.</p></section>
      </main>`
  }
];
