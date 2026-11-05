import { codeBlock, escapeHtml, renderFaq } from "../components.mjs";

// Troubleshooting. Each problem has a stable id so other pages, the CLI docs,
// and llms.txt can deep-link to it. Keep ids stable once published.
const problems = [
  {
    id: "bot-check",
    group: "YouTube and other sites",
    title: "YouTube says “Sign in to confirm you’re not a bot”",
    body: `
        <p>YouTube shows this when it decides a request looks automated. It often happens after many downloads in a row, on a VPN or shared network, or when your copy of yt-dlp is out of date.</p>
        <ol>
          <li>Update the download engine. New yt-dlp releases often fix this.${codeBlock("lyt doctor --update")}</li>
          <li>Wait a while before trying again, and download one thing at a time instead of many in parallel.</li>
          <li>If you use a VPN or a cloud computer, try again from your normal home connection.</li>
          <li>For media your own account can access, such as your own private or unlisted uploads, you can let lyt use your browser's login:${codeBlock('lyt --cookies-from-browser chrome "URL"')}Replace <code>chrome</code> with <code>firefox</code>, <code>edge</code>, or <code>safari</code> as needed.</li>
        </ol>
        <div class="callout">
          <h4>About browser cookies</h4>
          <p>Cookies are your login. Use <code>--cookies-from-browser</code> only for media your own account is allowed to see. Never share a cookies file, and do not paste it into an issue or a chat. lyt does not get around paywalls, memberships, or other access controls.</p>
        </div>`,
  },
  {
    id: "format-unavailable",
    group: "YouTube and other sites",
    title: "“Requested format is not available”",
    body: `
        <p>The quality or format you asked for is not offered for this video. For example, you asked for 4k but the video only goes up to 1080p, or the site changed and your yt-dlp is out of date.</p>
        <ol>
          <li>See which qualities the video offers:${codeBlock('lyt -L "URL"')}For the full details, including title, length, and formats, use <code>lyt info "URL"</code>.</li>
          <li>Ask for one of the listed qualities, or let lyt pick the best available:${codeBlock('lyt --video -q best "URL"')}</li>
          <li>If every format fails, update yt-dlp with <code>lyt doctor --update</code> and try again.</li>
        </ol>`,
  },
  {
    id: "http-403-429",
    group: "YouTube and other sites",
    title: "HTTP Error 403 (Forbidden) or 429 (Too Many Requests)",
    body: `
        <p><strong>429</strong> means the site is rate-limiting you: too many requests in a short time. <strong>403</strong> usually means the site refused a download link, which often happens when yt-dlp is out of date or a link expired mid-download.</p>
        <ol>
          <li>Stop and wait. For a 429, give it at least several minutes, sometimes an hour or more.</li>
          <li>Update yt-dlp, then retry:${codeBlock("lyt doctor --update")}</li>
          <li>Slow down: run one download at a time (no <code>-j</code>), and cap the speed if you are downloading a lot:${codeBlock('lyt -r 2M --retries 5 "URL"')}</li>
          <li>Check that the site is reachable from your network with <code>lyt doctor --network</code>.</li>
        </ol>
        <p>If you only get 403 for a private, members-only, or paid video, that is an access control. lyt does not get around it.</p>`,
  },
  {
    id: "ai-assistant",
    group: "AI assistants",
    title: "My AI assistant won't run the download",
    body: `
        <p>Every AI assistant, including Claude Code, Codex, and Gemini CLI, applies its own usage policies. Some decline download requests, especially for media from large platforms, when the purpose or the rights are unclear. That decision belongs to the assistant and its provider, not to lyt, and lyt does not change it.</p>
        <p>lyt is meant for your own uploads, Creative Commons and public-domain media, media you have licensed or have permission to use, and other uses the law allows. If your request is one of those, a few things help the assistant judge it:</p>
        <ul class="check-list">
          <li>Say plainly what the media is and what you will do with it. For example: this is my own upload, or this lecture is CC BY, or I have the creator's permission.</li>
          <li>Ask for only what you need. If you are quoting a few seconds for commentary, ask for that section with <code>--clip</code> instead of the whole video.</li>
          <li>Name lyt and the exact command if you know it, so the assistant does not have to guess.</li>
        </ul>
        <p>Fair use and similar exceptions depend on the specific facts, such as the purpose, how much you use, and the effect on the original. Using a clip in a YouTube video, giving credit, or not making money does not make a use fair on its own. The <a href="https://www.copyright.gov/fair-use/">U.S. Copyright Office fair use page</a> explains the factors.</p>
        <p>lyt is an ordinary command-line tool, and every command on this site works the same when you type it yourself in a terminal. Whoever runs it, you are responsible for making sure the download is allowed.</p>`,
  },
  {
    id: "ffmpeg-missing",
    group: "Setup",
    title: "“ffmpeg not found” or MP3, video, or clips fail",
    body: `
        <p>ffmpeg is the program that converts audio to MP3, joins video with sound, and cuts clips. Native audio downloads work without it.</p>
        <ul class="check-list">
          <li><strong>Windows:</strong> run <code>lyt doctor --fix</code> and lyt provisions a verified build, or install it yourself with <code>winget install Gyan.FFmpeg</code>.</li>
          <li><strong>Mac:</strong> <code>brew install ffmpeg</code></li>
          <li><strong>Debian or Ubuntu:</strong> <code>sudo apt install ffmpeg</code></li>
        </ul>
        <p>Open a new terminal afterwards and run <code>lyt doctor</code> to confirm.</p>`,
  },
  {
    id: "not-recognized",
    group: "Setup",
    title: "“lyt is not recognized” or “command not found”",
    body: `
        <ol>
          <li>Close the terminal and open a new one. New programs are not visible in windows that were already open.</li>
          <li>Check that Node.js is installed with <code>node --version</code>. You need version 20 or newer.</li>
          <li>Run <code>npm prefix --global</code> and make sure that folder (on Windows) or its <code>bin</code> folder (on Mac and Linux) is on your PATH.</li>
          <li>As a temporary check, run lyt without installing it globally:${codeBlock("npx --yes -p @tanattv/lyt lyt doctor")}</li>
        </ol>`,
  },
  {
    id: "powershell-scripts",
    group: "Setup",
    title: "PowerShell says “running scripts is disabled on this system”",
    body: `
        <p>Some Windows security settings block the <code>npm</code> script. Use the <code>.cmd</code> version, which does the same thing:</p>
        ${codeBlock("npm.cmd install --global @tanattv/lyt")}`,
  },
  {
    id: "eacces",
    group: "Setup",
    title: "npm says EACCES: permission denied (Mac or Linux)",
    body: `
        <p>npm is trying to install into a system folder your user cannot write to. This often happens with the Node.js installer from nodejs.org on a Mac. The cleanest fix is to install Node.js with Homebrew (<code>brew install node</code>) or a version manager, then install lyt again. npm explains the options in <a href="https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally">Resolving EACCES permissions errors</a>.</p>`,
  },
  {
    id: "certificate",
    group: "Setup",
    title: "Certificate errors during setup or download",
    body: `
        <p>Errors such as <em>unable to get local issuer certificate</em> usually mean a company network, school network, or security program is inspecting traffic. Ask whoever manages the network for the right certificate and add it to your system's trusted certificates. Do not turn off certificate checks to make the error go away.</p>`,
  },
  {
    id: "skipped",
    group: "Downloads",
    title: "lyt skipped a download",
    body: `
        <p>lyt tells you why it skipped something. The common reasons are:</p>
        <ul class="check-list">
          <li><strong>Already downloaded.</strong> lyt keeps a local history so it does not save the same thing twice. See it with <code>lyt history</code>, and add <code>--redownload</code> if you want another copy.</li>
          <li><strong>The file already exists.</strong> lyt never replaces a file unless you add <code>--force-overwrite</code>.</li>
          <li><strong>Too large.</strong> You set <code>--max-filesize</code> and the media is bigger. Raise the limit or pick a lower quality.</li>
          <li><strong>Only one item saved from a playlist link.</strong> Playlists are off by default. Add <code>--playlist</code> to save every item.</li>
        </ul>`,
  },
  {
    id: "spotify-100",
    group: "Downloads",
    title: "A Spotify playlist stops at 100 songs",
    body: `
        <p>Without Spotify API keys, lyt can read the first 100 songs of a public playlist. Create a free Spotify developer app, then set its keys once:</p>
        ${codeBlock(["lyt config set spotify-client-id <id>", "lyt config set spotify-client-secret <secret>"])}
        <p>lyt matches each song on YouTube and never downloads audio from Spotify.</p>`,
  },
  {
    id: "clipboard",
    group: "Downloads",
    title: "Clipboard features do not work on Linux",
    body: `
        <p><code>lyt --paste</code>, <code>lyt --watch</code>, and running <code>lyt</code> with a copied link need a clipboard tool on Linux. Install <code>xclip</code>, <code>xsel</code>, or <code>wl-clipboard</code>. Windows and macOS use built-in tools.</p>`,
  },
  {
    id: "get-help",
    group: "Still stuck?",
    title: "How to ask for help",
    body: `
        <ol>
          <li>Run <code>lyt doctor</code> and note what it reports.</li>
          <li>Copy the exact error message.</li>
          <li>Open an issue on <a href="https://github.com/TanaTTV/lyt/issues">GitHub</a>. Remove cookies, tokens, private links, and personal file paths before you post.</li>
        </ol>`,
  },
];

const groups = [...new Set(problems.map((problem) => problem.group))];

const tocHtml = groups.map((group) => `
          <div class="toc-group">
            <p class="toc-title">${escapeHtml(group)}</p>
            ${problems.filter((problem) => problem.group === group).map((problem) => `<a href="#${problem.id}">${problem.title}</a>`).join("\n            ")}
          </div>`).join("");

const problemsHtml = groups.map((group) => `
      <section class="trouble-group">
        <h2>${escapeHtml(group)}</h2>${problems.filter((problem) => problem.group === group).map((problem) => `
        <article class="trouble" id="${problem.id}">
          <h3>${problem.title}</h3>${problem.body}
        </article>`).join("")}
      </section>`).join("");

const faq = [
  {
    q: "How do I fix “Sign in to confirm you’re not a bot” on YouTube?",
    a: "Update yt-dlp with lyt doctor --update, wait before retrying, and download one item at a time. If you are on a VPN or cloud computer, try your normal home connection. For media your own account can access, you can add --cookies-from-browser with your browser name. Never share your cookies.",
  },
  {
    q: "What does “Requested format is not available” mean?",
    a: "The quality you asked for is not offered for that video. Run lyt -L \"URL\" or lyt info \"URL\" to see the available qualities, then choose one of them or use -q best. If nothing works, update yt-dlp with lyt doctor --update.",
  },
  {
    q: "How do I fix HTTP Error 429 or 403?",
    a: "429 means you are being rate-limited, so stop and wait before trying again. 403 often means yt-dlp is out of date or a link expired. Update with lyt doctor --update, run one download at a time, and consider -r 2M --retries 5. lyt does not get around private, paid, or members-only access.",
  },
  {
    q: "Why won't my AI assistant download a video with lyt?",
    a: "Each AI assistant applies its own usage policies, and some decline download requests when the purpose or rights are unclear. lyt does not change that. lyt is meant for your own uploads, Creative Commons and public-domain media, licensed media, and other uses the law allows. Stating your actual purpose and asking only for the section you need with --clip helps the assistant judge the request. No use is automatically fair use.",
  },
  {
    q: "How do I update yt-dlp in lyt?",
    a: "Run lyt doctor --update. It runs yt-dlp's own updater on the copy lyt uses. If your yt-dlp came from a package manager such as Homebrew, pip, or apt, update it with that package manager instead. Many errors caused by site changes are fixed by a newer yt-dlp.",
  },
];

export const help = {
  slug: "help",
  nav: "Help",
  title: "lyt help: fix YouTube bot checks, 403/429 and format errors",
  description: "Fix common lyt and yt-dlp problems: YouTube bot checks, “Requested format is not available”, HTTP 403 and 429, missing ffmpeg, and AI assistant refusals.",
  faq,
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Help and troubleshooting</div>
      <h1>Something went wrong? Start here.</h1>
      <p class="lede">Most problems have a quick fix. Find the message you are seeing below. If nothing matches, run <code>lyt doctor</code>: it checks your setup and tells you what is missing.</p>

      <div class="quick-fix">
        <p><strong>First try:</strong> update the download engine. Video sites change often, and a newer yt-dlp fixes many errors. If your yt-dlp came from Homebrew, pip, or another package manager, update it there instead.</p>
        ${codeBlock("lyt doctor --update")}
      </div>

      <nav class="toc toc-columns" aria-label="Problems on this page">${tocHtml}
      </nav>
${problemsHtml}

      ${renderFaq(faq, { heading: "Troubleshooting questions" })}

      <p class="legal-note">Use lyt only for media you own, have permission or a license for, that is in the public domain, or where an applicable copyright exception allows it. lyt does not bypass DRM, paywalls, or access controls. This page is not legal advice.</p>

      <div class="page-actions">
        <a class="button primary" href="../start/">Beginner setup guide</a>
        <a class="button secondary" href="https://github.com/TanaTTV/lyt/issues">Open a GitHub issue</a>
      </div>
    </main>`,
};
