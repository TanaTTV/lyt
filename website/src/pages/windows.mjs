import { renderFaq } from "../components.mjs";

const faq = [
  {
    q: "Do I have to add yt-dlp to PATH on Windows?",
    a: "No. lyt keeps its own checksum-verified yt-dlp in its managed folder and calls it by full path. The only PATH requirement is that npm's global folder is on PATH, which the Node.js installer sets up."
  },
  {
    q: "Does installing lyt change my PATH?",
    a: "npm install --global and the lyt commands do not edit PATH. The optional install script in a source checkout, install\\install.ps1, adds lyt's managed tools folder to your user PATH only when it falls back to managed tools."
  },
  {
    q: "Where does lyt save files and keep its data on Windows?",
    a: "Downloads go to a downloads folder under the directory you run lyt from, unless you pass -o. Managed tools, config, and history live in %LOCALAPPDATA%\\lyt. Run lyt doctor to see the exact paths on your machine."
  },
  {
    q: "Why does lyt say ffmpeg was not found?",
    a: "ffmpeg is needed for MP3 conversion, video merging, clips, and similar options. Run lyt doctor --fix to let lyt provision a verified build. You can also install it yourself with winget install Gyan.FFmpeg. Native audio does not need ffmpeg."
  }
];

export const windows = {
  slug: "windows",
  title: "Easy yt-dlp on Windows without PATH setup | lyt",
  description: "Set up yt-dlp on Windows with lyt: a checksum-verified managed copy, ffmpeg provisioning, PowerShell commands, output folders, and common fixes.",
  faq,
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Windows guide</div>
      <h1>Easy yt-dlp on Windows, without hunting for PATH.</h1>
      <p class="lede">Installing yt-dlp by hand on Windows usually means downloading an executable, placing it in a folder, and editing PATH. lyt manages a checksum-verified yt-dlp for you and provisions ffmpeg when it is missing. You install Node.js and run one npm command.</p>

      <section>
        <h2>1. Install Node.js 20 or newer</h2>
        <p>Download the current LTS release from the <a href="https://nodejs.org/">official Node.js website</a>. Then open a new PowerShell window and check the version:</p>
        <div class="code-block"><pre><code>node --version</code></pre><button class="copy" data-copy="node --version" aria-live="polite"><span class="copy-label">Copy</span></button></div>
      </section>

      <section>
        <h2>2. Install lyt and check readiness</h2>
        <div class="code-block"><pre><code>npm install --global @tanattv/lyt
lyt doctor</code></pre><button class="copy" data-copy="npm install --global @tanattv/lyt&#10;lyt doctor" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p>If PowerShell blocks <code>npm</code> with an execution-policy error, use <code>npm.cmd</code> in its place.</p>
        <div class="code-block"><pre><code>npm.cmd install --global @tanattv/lyt</code></pre><button class="copy" data-copy="npm.cmd install --global @tanattv/lyt" aria-live="polite"><span class="copy-label">Copy</span></button></div>
      </section>

      <section>
        <h2>3. Let lyt provision missing tools</h2>
        <div class="code-block"><pre><code>lyt doctor --fix</code></pre><button class="copy" data-copy="lyt doctor --fix" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p>On Windows, <code>--fix</code> downloads yt-dlp from its GitHub release and checks it against the published checksum. If no usable ffmpeg is found, lyt uses one it can find, such as an existing install or a WinGet link, or downloads a verified Windows build into its managed folder.</p>
        <div class="callout">
          <h2>Approve managed downloads</h2>
          <p>These steps download and install tools. Run them only when you approve those downloads. To require tools already on your PATH, add <code>--no-download</code> to your commands or set <code>LYT_NO_DOWNLOAD=1</code>.</p>
        </div>
      </section>

      <section>
        <h2>4. Save a video to your Downloads folder</h2>
        <div class="code-block"><pre><code>lyt --video -q 1080p -o "$HOME/Downloads" "URL"</code></pre><button class="copy" data-copy="lyt --video -q 1080p -o &quot;$HOME/Downloads&quot; &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p>lyt prints the exact path of the saved file. A run looks like this:</p>
        <div class="code-block"><pre><code>Saved: C:\\Users\\you\\Downloads\\Example [abc123].mp4</code></pre></div>
      </section>

      <section>
        <h2>5. Save MP3s to a music folder</h2>
        <div class="code-block"><pre><code>lyt --mp3 -q 192K -o "D:/Music" "URL"</code></pre><button class="copy" data-copy="lyt --mp3 -q 192K -o &quot;D:/Music&quot; &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button></div>
        <p>Use forward slashes or quoted Windows paths. Set a default folder once with <code>lyt config set output-dir "D:/Music"</code>.</p>
      </section>

      <section>
        <h2>Quote URLs in PowerShell</h2>
        <div class="callout">
          <h2>PowerShell tip</h2>
          <p>Always put the URL in quotes. Characters such as <code>&amp;</code> and <code>?</code> can otherwise be interpreted by PowerShell instead of passed to lyt.</p>
        </div>
      </section>

      <section>
        <h2>Common Windows fixes</h2>
        <ul class="check-list">
          <li>Close and reopen PowerShell after installing Node.js or lyt.</li>
          <li>If <code>lyt</code> is not found, run <code>npm prefix --global</code> and confirm that folder is on your PATH.</li>
          <li>Run <code>npx --yes -p @tanattv/lyt lyt doctor</code> as a temporary diagnostic when the global command is not available.</li>
          <li>If ffmpeg is missing for MP3 or video work, run <code>lyt doctor --fix</code>, or install it yourself with <code>winget install Gyan.FFmpeg</code>.</li>
          <li>When asking for help, include the exact error, but not private URLs, cookies, or personal paths.</li>
        </ul>
      </section>

      ${renderFaq(faq)}

      <div class="page-actions">
        <a class="button primary" href="../install/">Full install guide</a>
        <a class="button secondary" href="../commands/">Command reference</a>
      </div>
    </main>`
};
