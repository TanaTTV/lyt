import { readFileSync } from "node:fs";
import { renderFaq } from "./components.mjs";
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const codeBlock = (lines) => {
  const text = lines.join("\n");
  return `<div class="code-block"><pre><code>${esc(text)}</code></pre><button class="copy" data-copy="${esc(text)}" aria-live="polite"><span class="copy-label">Copy</span></button></div>`;
};
const tasks = [
  {
    slug: "codex-audio",
    title: "Download YouTube audio as MP3 with Codex | lyt",
    name: "Codex",
    lede: "Ask Codex for an MP3 in plain language. With the lyt skill installed, Codex runs one command, checks the result, and tells you exactly where the file was saved.",
    description: "Install the lyt skill for Codex, save permitted YouTube audio as a 192 kbps MP3, and read the exact local file path from lyt.result.v1 JSON.",
    agent: "codex",
    heading: "Save YouTube audio as MP3 with Codex.",
    prompt: "This is my upload. Save the audio from this URL as a 192 kbps MP3 and tell me where it was saved.",
    command: 'lyt --mp3 -q 192K --max-filesize 100M --json "URL"',
    mode: "audio",
    path: "/downloads/example.mp3",
    faq: [
      { q: "How do I make Codex save YouTube audio as MP3?", a: "Install the skill with lyt agent install codex, then ask Codex for an MP3 and provide the URL. Codex can run lyt --mp3 -q 192K --json \"URL\" and report the path listed in results[].files. Use this only for media you have the rights to download." },
      { q: "Where does the lyt skill for Codex get installed?", a: "The direct Codex skill installs to ~/.agents/skills/lyt/. Run lyt agent install codex again after upgrading lyt. The installer does not delete older or custom copies, so compare them before removing anything." },
      { q: "Can Codex check the audio before it downloads?", a: "Yes. lyt info --no-download --json \"URL\" returns the title, duration, uploader, and formats. It contacts the media host but downloads no media and provisions no tools." },
      { q: "What does Codex get back when the MP3 download succeeds?", a: "One lyt.result.v1 JSON document on stdout. Codex should check ok and the exit status, confirm the file exists, and then report the path from results[].files. A failure must not be reported as a saved file." },
    ],
  },
  {
    slug: "claude-video",
    title: "Download YouTube videos with Claude Code | lyt",
    name: "Claude Code",
    lede: "Ask Claude Code for a video at the quality and size you want. With the lyt skill installed, it runs one command and reports the saved path from structured JSON.",
    description: "Set up the lyt skill in Claude Code, download a permitted video at up to 1080p, and verify the saved file path with versioned lyt.result.v1 JSON.",
    agent: "claude",
    heading: "Download your YouTube videos with Claude Code.",
    prompt: "This is my video. Download it at up to 1080p, keep it under 100 MB, and give me the saved path.",
    command: 'lyt --video -q 1080p --max-filesize 100M --json "URL"',
    mode: "video",
    path: "/downloads/example.mp4",
    faq: [
      { q: "How do I set up the lyt skill in Claude Code?", a: "Install the CLI with npm install --global @tanattv/lyt, run lyt doctor, then run lyt agent install claude. The skill is installed to ~/.claude/skills/lyt/ and can be selected for matching tasks." },
      { q: "Can Claude Code download a YouTube video at 1080p with lyt?", a: "Yes. A request can use lyt --video -q 1080p --json \"URL\". The 1080p setting is a cap, not a guarantee, because the source may offer only lower resolutions. Add --max-filesize to keep the file under your limit." },
      { q: "Does video download with lyt need ffmpeg?", a: "Video merging needs ffmpeg. On Windows lyt can provision a verified ffmpeg build. On macOS and Linux, lyt doctor shows the package-manager command to install it." },
      { q: "How can Claude Code check a video before downloading it?", a: "Run lyt info --no-download --json \"URL\" to read the title, duration, and available formats. Inspection contacts the media host but downloads no media." },
    ],
  },
  {
    slug: "agent-clips",
    title: "Clip YouTube videos with Codex or Claude Code | lyt",
    name: "your agent",
    lede: "Give your agent a start and end time. lyt downloads only that section, keeps it under your size limit, and returns the exact path of the clip.",
    description: "Use lyt to save a permitted video segment with Codex or Claude Code, inspect formats first, cap file size, and report the exact local file path.",
    agent: "all",
    heading: "Clip a video with your AI coding agent.",
    prompt: "From my video, save only 00:10 through 00:20 at up to 720p and report the final file path.",
    command: 'lyt --video --clip 00:10-00:20 -q 720p --max-filesize 100M --json "URL"',
    mode: "video",
    path: "/downloads/example-clip.mp4",
    faq: [
      { q: "How do I make Codex or Claude Code save only part of a video?", a: "Give the agent a time range and it can run lyt --video --clip 00:10-00:20 -q 720p --json \"URL\". The --clip option takes one time section per use." },
      { q: "Do lyt clips need ffmpeg?", a: "Yes. Clips depend on ffmpeg. Run lyt doctor to see whether it is available and, on macOS or Linux, the package-manager command to install it." },
      { q: "Can an agent download more than one clip from a video?", a: "The --clip option can be repeated. Check every entry in results[].files after the run and report each path that exists." },
      { q: "What should an agent report after saving a clip?", a: "The exact path from results[].files, after confirming it exists. A clip is a local file and does not establish publishing rights, so explain those rights separately if the user plans to publish it." },
    ],
  },
];
export const discoveryPages = tasks.map((task) => {
  const example = JSON.stringify({schema: "lyt.result.v1", version, command: "download", ok: true, results: [{url: "URL", status: "downloaded", mode: task.mode, files: [task.path], outputDir: "/downloads"}]}, null, 2);
  return {slug: task.slug, title: task.title, description: task.description, faq: task.faq, body: `
    <main id="main" class="doc shell">
      <div class="kicker">Agent task guide</div><h1>${task.heading}</h1>
      <p class="lede">${task.lede}</p>
      <section><h2>How do I install the lyt skill for ${task.name}?</h2><p>Requires Node.js 20 or newer and a terminal the agent can run. Approve global installation and managed tool setup once. Network access to the media host is required. ffmpeg is needed for MP3 conversion, video merging, and clips.</p>${codeBlock(["npm install --global @tanattv/lyt", `lyt agent install ${task.agent}`, "lyt doctor --json", "lyt capabilities --json"])}<p>Codex user skills live in <code>~/.agents/skills/lyt/</code>. Claude Code skills live in <code>~/.claude/skills/lyt/</code>. An installed and enabled skill can be selected for matching tasks; selection depends on the agent.</p></section>
      <section><h2>What should I ask ${task.name}?</h2><blockquote>${task.prompt}</blockquote><p>Replace URL with your media link. Ownership, permission, licenses, public domain, or applicable exceptions can support the download. Downloading does not establish publication rights.</p></section>
      <section><h2>How does ${task.name} check the media before downloading?</h2><p>Inspection contacts the media host but does not download media. With <code>--no-download</code> it also avoids provisioning tools.</p>${codeBlock(['lyt info --no-download --json "URL"', task.command])}<p>A quality setting is a cap, not a guarantee that the source offers that resolution.</p></section>
      <section><h2>How does ${task.name} know where the file was saved?</h2><p>This is an illustrative success response. Names and paths depend on the source and output directory. Read JSON from stdout and diagnostics from stderr. Check the exit status and <code>ok</code> before using <code>results[].files</code>.</p><div class="code-block"><pre><code>${esc(example)}</code></pre></div><p>Failure must not be reported as a saved file. Verify that successful paths exist. Playlist downloads and overwrites remain opt-in.</p></section>
      <section><h2>What if the download or setup fails?</h2><p>Run <code>lyt doctor --json</code> for missing tools. A certificate trust error may require correctly configuring your environment's trusted certificates. Do not disable certificate verification as a default fix. A host or network proxy may return an HTML error page instead of media, causing an invalid-input conversion error. That needs an access or network fix; lyt cannot guarantee access from a restricted agent environment.</p></section>
      <section><h2>Related guides</h2><div class="guide-grid compact">${tasks.filter((other) => other !== task).map((other) => `<a class="guide" href="../${other.slug}/"><span>Guide</span><b>${other.heading.replace(/.$/, "")}</b><i aria-hidden="true">→</i></a>`).join("")}<a class="guide" href="../commands/"><span>Reference</span><b>Every lyt command, ready to copy</b><i aria-hidden="true">→</i></a></div></section>
      ${renderFaq(task.faq)}
      <div class="page-actions"><a class="button primary" href="../agents/">Agent setup guide</a><a class="button secondary" href="../ai/">AI product facts</a></div>
    </main>`};
});
