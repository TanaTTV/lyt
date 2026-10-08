import { renderFaq } from "../components.mjs";

const faq = [
  {
    q: "How do I install yt-dlp on Windows the easy way?",
    a: "Install Node.js 20 or newer, run npm install --global @tanattv/lyt, then run lyt doctor --fix. lyt downloads a checksum-verified yt-dlp into its own managed folder and calls it directly, so you do not download, unzip, or add yt-dlp to PATH yourself."
  },
  {
    q: "Do I need to install ffmpeg separately?",
    a: "Not for native audio, which needs only Node.js and yt-dlp. MP3 conversion, video merging, clips, chapters, thumbnails, and normalization need ffmpeg. On Windows, lyt uses an ffmpeg it can find or provisions a verified build. On macOS, run brew install ffmpeg. On Debian or Ubuntu, run sudo apt install ffmpeg."
  },
  {
    q: "How do I update lyt?",
    a: "lyt does not update itself. Run npm install --global @tanattv/lyt@latest, then run lyt agent install all to refresh installed agent skills. lyt doctor reports when a newer release is on npm. To update only yt-dlp, run lyt doctor --update."
  },
  {
    q: "Does lyt need an account or a hosted service?",
    a: "No. lyt has no account system and no hosted service. Files, config, and history stay on your machine. Downloads still contact the media site you request, and setup contacts release sources for managed tools."
  },
  {
    q: "Where does lyt save my downloads?",
    a: "By default, lyt saves to a downloads folder under the directory you run it from and prints the exact final path. Choose another folder with -o, for example lyt --mp3 -o \"D:/Music\" \"URL\"."
  },
  {
    q: "Why does PowerShell say npm cannot be loaded?",
    a: "Some Windows PowerShell execution policies block npm.ps1. Run npm.cmd install --global @tanattv/lyt instead, open a new terminal, and run lyt doctor."
  }
];

export const install = {
  slug: "install",
  nav: "Install",
  title: "Install lyt — easy yt-dlp CLI for Windows, macOS, Linux",
  description: "Install lyt with one npm command on Windows, macOS, or Linux. Check yt-dlp and ffmpeg with lyt doctor, then save your first permitted file.",
  faq,
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Install</div>
      <h1>Install lyt and save your first file.</h1>
      <p class="lede">lyt is a command-line tool for permitted audio and video downloads. Install it with one npm command. lyt provisions a checksum-verified yt-dlp for you, checks ffmpeg, and tells you what is still missing.</p>

      <section>
        <h2>Requirements</h2>
        <ul class="check-list">
          <li>Node.js 20 or newer. Check with <code>node --version</code>.</li>
          <li>npm, which ships with Node.js.</li>
          <li>A terminal. lyt runs on Windows, macOS, and Linux.</li>
        </ul>
        <div class="callout">
          <h2>Permission first</h2>
          <p>Download only media you own, have permission or a licence for, or that is public domain or covered by an applicable exception. Do not use lyt to get around DRM, paywalls, or access controls.</p>
        </div>
      </section>

      <section>
        <h2>1. Install the CLI</h2>
        <p>This installs the <code>lyt</code>, <code>yt3</code>, and <code>yt4</code> commands.</p>
        <div class="code-block"><pre><code>npm install --global @tanattv/lyt</code></pre><button class="copy" data-copy="npm install --global @tanattv/lyt" aria-live="polite"><span class="copy-label">Copy</span></button></div>
      </section>

      <section>
        <h2>2. Check readiness with lyt doctor</h2>
        <div class="code-block"><pre><code>lyt doctor</code></pre><button class="copy" data-copy="lyt doctor" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p><code>lyt doctor</code> separates core readiness (Node.js and yt-dlp) from optional capabilities such as MP3 conversion, video merging, clips, and clipboard integration. It reports only; it does not install anything.</p>
        <div class="code-block"><pre><code>lyt doctor --fix</code></pre><button class="copy" data-copy="lyt doctor --fix" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p><code>--fix</code> installs missing tools. yt-dlp is downloaded, checksum-verified, and stored in lyt's managed folder. On Windows, if no usable ffmpeg is found, lyt provisions a verified build. On macOS and Linux, lyt does not install ffmpeg; <code>doctor</code> prints the package-manager command to run.</p>
        <div class="callout">
          <h2>Approve managed downloads</h2>
          <p><code>lyt doctor --fix</code> downloads and installs tools. Run it only when you approve those downloads. To require tools already on your PATH instead, use <code>--no-download</code> or set <code>LYT_NO_DOWNLOAD=1</code>.</p>
        </div>
      </section>

      <section>
        <h2>3. Save your first file</h2>
        <p>Quote every URL. Each example saves one item unless you add <code>--playlist</code>.</p>
        <div class="recipe-grid">
          <article><span>Audio · native</span><code>lyt "URL"</code><button class="copy" data-copy="lyt &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></article>
          <article><span>MP3 · 192K</span><code>lyt --mp3 -q 192K "URL"</code><button class="copy" data-copy="lyt --mp3 -q 192K &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></article>
          <article><span>Video · 1080p</span><code>lyt --video -q 1080p "URL"</code><button class="copy" data-copy="lyt --video -q 1080p &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></article>
          <article><span>Clip · 1:10 to 2:45</span><code>lyt --mp3 --clip 1:10-2:45 "URL"</code><button class="copy" data-copy="lyt --mp3 --clip 1:10-2:45 &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></article>
          <article><span>Spotify playlist · MP3s</span><code>lyt "https://open.spotify.com/playlist/..."</code><button class="copy" data-copy="lyt &quot;https://open.spotify.com/playlist/...&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></article>
          <article><span>Dry run · no install, no download</span><code>lyt --video -q 1080p --dry-run "URL"</code><button class="copy" data-copy="lyt --video -q 1080p --dry-run &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></article>
        </div>
        <p>For Spotify links, lyt reads the public track list and finds each song on YouTube. lyt never downloads Spotify audio itself.</p>
      </section>

      <section>
        <h2>Where does the file go?</h2>
        <p>By default, lyt saves to a <code>downloads</code> folder under the current directory and prints the exact final path. Add <code>-o</code> to choose another folder, or <code>--json</code> to receive the final paths in one JSON document.</p>
        <div class="code-block"><pre><code>lyt --mp3 -q 192K -o "D:/Music" "URL"</code></pre><button class="copy" data-copy="lyt --mp3 -q 192K -o &quot;D:/Music&quot; &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></div>
      </section>

      <section>
        <h2>Set up your agent</h2>
        <p>Once lyt works in your terminal, install its skill for Codex, Claude Code, or both. Agents then run lyt with <code>--json</code> and read one result document from stdout.</p>
        <div class="code-block"><pre><code>lyt agent install all</code></pre><button class="copy" data-copy="lyt agent install all" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p><a class="text-link" href="../agents/">Set up lyt for your agent</a></p>
      </section>

      <section>
        <h2>Updating</h2>
        <p>lyt does not install its own updates. When <code>lyt doctor</code> reports a newer release, run the npm command it prints, then refresh the agent skills.</p>
        <div class="code-block"><pre><code>npm install --global @tanattv/lyt@latest
lyt agent install all</code></pre><button class="copy" data-copy="npm install --global @tanattv/lyt@latest&#10;lyt agent install all" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p>Update yt-dlp separately with <code>lyt doctor --update</code>.</p>
      </section>

      <section>
        <h2>Common first-run fixes</h2>
        <ul class="check-list">
          <li>Confirm <code>node --version</code> reports 20 or newer.</li>
          <li>If PowerShell blocks npm, use <code>npm.cmd install --global @tanattv/lyt</code>.</li>
          <li>Run <code>lyt doctor</code> again after an install, then <code>lyt doctor --fix</code> if a tool is missing.</li>
          <li>Use <code>--dry-run</code> to preview a job without installing or downloading.</li>
          <li>If a matching variant is skipped, check <code>lyt history</code>, then add <code>--redownload</code> only if another copy is intentional.</li>
          <li>When asking for help, share the exact error, not cookies, private URLs, tokens, or personal paths.</li>
        </ul>
      </section>

      ${renderFaq(faq)}

      <div class="page-actions">
        <a class="button primary" href="https://www.npmjs.com/package/@tanattv/lyt">Open npm package</a>
        <a class="button secondary" href="https://github.com/TanaTTV/lyt/issues">Get help</a>
      </div>
    </main>`
};
