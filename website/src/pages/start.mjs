import { codeBlock, renderFaq } from "../components.mjs";

// Plain-language path for people who have never used a terminal.
// Every command here must exist in `node bin/lyt.js --help`; check-seo.mjs
// verifies each --flag against the CLI.

export const commonTasks = [
  {
    id: "song-mp3",
    title: "Save a song as an MP3",
    text: "Gets the audio and converts it to an MP3 file at 320 kbps. Use 192K for smaller files.",
    command: 'lyt --mp3 -q 320K "URL"',
  },
  {
    id: "video-1080p",
    title: "Save a video in 1080p",
    text: "Saves the video with sound as an .mp4, at up to 1080p. If the source is lower quality, you get the best it has.",
    command: 'lyt --video -q 1080p "URL"',
  },
  {
    id: "clip-for-edit",
    title: "Cut a clip for an edit",
    text: "Saves only the part between 1:10 and 1:40 as an .mp4 you can drop into your editor. Change the times to the part you need.",
    command: 'lyt --video -q 1080p --clip 1:10-1:40 "URL"',
  },
  {
    id: "subtitles",
    title: "Grab the subtitles",
    text: "Saves English subtitles as an .srt text file next to the audio. Use another language code, such as es or de, if you need one.",
    command: 'lyt --subs --sub-langs en "URL"',
  },
  {
    id: "playlist",
    title: "Download a whole playlist",
    text: "Playlists are off by default so a link never surprises you. Add --playlist to save every item as an MP3 in a numbered folder.",
    command: 'lyt --mp3 --playlist "URL"',
  },
];

export function renderTaskCards(tasks, { headingLevel = 3 } = {}) {
  return tasks.map((task) => `
          <article class="task" id="${task.id}">
            <h${headingLevel}>${task.title}</h${headingLevel}>
            <p>${task.text}</p>
            ${codeBlock(task.command)}
          </article>`).join("");
}

const faq = [
  {
    q: "What is a terminal?",
    a: "A terminal is a window where you type commands instead of clicking buttons. On Windows it is called PowerShell or Terminal. On a Mac it is called Terminal. You type a command, press Enter, and the computer prints the result.",
  },
  {
    q: "Do I need to know how to code to use lyt?",
    a: "No. You copy one install command, then one command per download. Each command on this page can be copied with the Copy button and pasted into the terminal. Replace URL with the link to the video or song.",
  },
  {
    q: "Where do my downloaded files go?",
    a: "Into a folder called downloads inside the folder the terminal is open in, and lyt prints the full path when it finishes. To always save to your Downloads folder, run lyt config set output-dir once, as shown in step 5.",
  },
  {
    q: "Is lyt safe to install?",
    a: "lyt is free, open-source, and MIT-licensed, and you can read every line on GitHub. It has no account, sends no usage analytics, and checks the yt-dlp program it downloads against a published checksum before using it.",
  },
  {
    q: "Am I allowed to download any video?",
    a: "No. Download only media you own, have permission or a license for, that is in the public domain or under a Creative Commons license that allows it, or where another exception in your country's law applies. Being publicly viewable does not make a video free to download or reuse. This is not legal advice.",
  },
];

export const start = {
  slug: "start",
  nav: "Start here",
  title: "New to the terminal? Install lyt step by step",
  description: "Plain-words guide for Windows and Mac: open a terminal, install Node.js and lyt, then save an MP3, a 1080p video, a clip, subtitles, or a playlist.",
  faq,
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Start here</div>
      <h1>New to the terminal? Start here.</h1>
      <p class="lede">You do not need to be a developer to use lyt. This guide walks you through it in plain words: open a terminal, install two free programs, and save your first file. It takes about ten minutes.</p>

      <nav class="toc" aria-label="On this page">
        <a href="#windows">Windows steps</a>
        <a href="#mac">Mac steps</a>
        <a href="#first-file">Your first file</a>
        <a href="#common-tasks">Common tasks</a>
        <a href="#faq">Questions</a>
      </nav>

      <section>
        <h2>Before you start</h2>
        <ul class="check-list">
          <li><strong>The terminal</strong> is a window where you type a command and press Enter. Every command below has a Copy button, so you can paste instead of typing.</li>
          <li><strong>Node.js</strong> is a free program lyt runs on. You install it once.</li>
          <li><strong>lyt</strong> then sets up the download engine (yt-dlp) for you and tells you if anything else is missing.</li>
          <li>Wherever you see <code>URL</code>, paste the link to the video or song, and keep the quotes around it.</li>
        </ul>
        <div class="callout">
          <h3>Only download what you are allowed to</h3>
          <p>Use lyt for your own uploads, Creative Commons or public-domain media, media you have permission or a license for, and other uses your local law allows. lyt does not get around DRM, paywalls, or logins.</p>
        </div>
      </section>

      <section id="windows">
        <h2>Windows: install in five steps</h2>
        <ol class="howto">
          <li>
            <h3>Install Node.js</h3>
            <p>Go to <a href="https://nodejs.org/">nodejs.org</a>, download the <strong>LTS</strong> version for Windows, open the file, and click Next until it finishes. The default options are fine.</p>
          </li>
          <li>
            <h3>Open PowerShell</h3>
            <p>Press the Windows key, type <strong>PowerShell</strong> (or <strong>Terminal</strong>), and press Enter. A window with a blinking cursor opens. Check that Node.js is installed:</p>
            ${codeBlock("node --version")}
            <p>You should see a version that starts with <code>v20</code> or higher. If you see an error, close the window, open a new one, and try again.</p>
          </li>
          <li>
            <h3>Install lyt</h3>
            ${codeBlock("npm install --global @tanattv/lyt")}
            <p>If PowerShell says <em>running scripts is disabled on this system</em>, use this instead:</p>
            ${codeBlock("npm.cmd install --global @tanattv/lyt")}
          </li>
          <li>
            <h3>Let lyt set up its tools</h3>
            ${codeBlock("lyt doctor --fix")}
            <p>This downloads yt-dlp and, if needed, ffmpeg (the program that makes MP3s and joins video with sound). lyt checks the downloads before using them. Run it only if you are OK with lyt installing these tools.</p>
          </li>
          <li>
            <h3>Choose where files are saved</h3>
            <p>Run this once to send every download to a <strong>lyt</strong> folder inside your Downloads folder:</p>
            ${codeBlock('lyt config set output-dir "$HOME/Downloads/lyt"')}
          </li>
        </ol>
        <p>Want more detail? The <a href="../windows/">Windows guide</a> covers PATH problems and other fixes.</p>
      </section>

      <section id="mac">
        <h2>Mac: install in five steps</h2>
        <ol class="howto">
          <li>
            <h3>Open Terminal</h3>
            <p>Press <kbd>Cmd</kbd> + <kbd>Space</kbd>, type <strong>Terminal</strong>, and press Enter.</p>
          </li>
          <li>
            <h3>Install Homebrew</h3>
            <p>On a Mac, lyt needs ffmpeg for MP3s and video, and the easiest way to get it is Homebrew, a free installer for this kind of tool. Follow the one-line install on <a href="https://brew.sh/">brew.sh</a>. Skip this step if you already have it.</p>
          </li>
          <li>
            <h3>Install Node.js and ffmpeg</h3>
            ${codeBlock("brew install node ffmpeg")}
            <p>Then check Node.js. You should see <code>v20</code> or higher:</p>
            ${codeBlock("node --version")}
          </li>
          <li>
            <h3>Install lyt and its download engine</h3>
            ${codeBlock(["npm install --global @tanattv/lyt", "lyt doctor --fix"])}
            <p><code>lyt doctor --fix</code> downloads yt-dlp and checks it before use. If npm reports a permission error (<code>EACCES</code>), see <a href="../help/#eacces">the fix on the help page</a>.</p>
          </li>
          <li>
            <h3>Choose where files are saved</h3>
            ${codeBlock('lyt config set output-dir "$HOME/Downloads/lyt"')}
          </li>
        </ol>
        <p>On Linux, install Node.js 20 or newer and ffmpeg with your package manager, then follow the Mac steps from step 4.</p>
      </section>

      <section id="first-file">
        <h2>Save your first file</h2>
        <p>Copy a link from your browser, then paste it into this command in place of <code>URL</code>. Keep the quotes.</p>
        ${codeBlock('lyt --mp3 "URL"')}
        <p>When it finishes, lyt prints <strong>Saved:</strong> and the full path of the file. Open that folder to find it.</p>
        <p>Prefer to be asked? Run <code>lyt -i "URL"</code> and lyt asks you what you want, one question at a time. On Windows and Mac you can also copy a link and type just <code>lyt</code>, and lyt reads the link from your clipboard.</p>
        <p>To see what lyt would do without downloading anything, add <code>--dry-run</code> to any command.</p>
      </section>

      <section id="common-tasks">
        <h2>Common tasks</h2>
        <p>Copy the command, replace <code>URL</code> with your link, and press Enter. Each one saves a single item unless it says otherwise.</p>
        <div class="task-grid">${renderTaskCards(commonTasks)}
        </div>
        <p>More recipes are in the <a href="../commands/">command reference</a>. Something went wrong? See <a href="../help/">help and troubleshooting</a>.</p>
      </section>

      <section>
        <h2>Keep it up to date</h2>
        <p>Video sites change often, and many download errors are fixed by a newer yt-dlp. Update it with:</p>
        ${codeBlock("lyt doctor --update")}
        <p>To update lyt itself, run <code>npm install --global @tanattv/lyt@latest</code>. <code>lyt doctor</code> tells you when a new version is out.</p>
      </section>

      ${renderFaq(faq, { heading: "Beginner questions" })}

      <div class="page-actions">
        <a class="button primary" href="../help/">Help and troubleshooting</a>
        <a class="button secondary" href="../commands/">All commands</a>
      </div>
    </main>`,
};
