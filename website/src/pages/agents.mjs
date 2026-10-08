import { readFileSync } from "node:fs";
import { renderFaq } from "../components.mjs";

const { version } = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const codeBlock = (lines) => {
  const text = lines.join("\n");
  return `<div class="code-block"><pre><code>${esc(text)}</code></pre><button class="copy" data-copy="${esc(text)}" aria-live="polite"><span class="copy-label">Copy</span></button></div>`;
};
const resultExample = JSON.stringify({
  schema: "lyt.result.v1",
  version,
  command: "download",
  ok: true,
  results: [{ url: "URL", status: "downloaded", mode: "audio", files: ["/downloads/example.mp3"], outputDir: "/downloads" }],
}, null, 2);

const faq = [
  { q: "Can Claude Code download YouTube audio with lyt?", a: "Yes, after you install the direct skill with lyt agent install claude. Claude Code can then run lyt with --json, read the result, and report the exact saved path. Download only media you have the rights to use." },
  { q: "How do I install the lyt skill for Codex?", a: "Install the CLI with npm install --global @tanattv/lyt, then run lyt agent install codex. The skill is installed to ~/.agents/skills/lyt/. Run the installer again after upgrading lyt." },
  { q: "Does lyt give AI agents JSON output?", a: "Yes. With --json, stdout contains one lyt.result.v1 document. Setup and progress diagnostics go to stderr. Successful final file paths are listed in results[].files." },
  { q: "Can an agent check a URL before downloading it?", a: "Yes. lyt info --no-download --json \"URL\" returns metadata and available formats without downloading media. It still contacts the media host, so it is not an offline check." },
  { q: "Does installing the lyt skill make an agent download anything?", a: "No. The skill makes lyt available to the agent. The agent chooses it based on the task and its configuration, and every download still needs a permitted purpose and must follow the agent's own policies." },
  { q: "Can an agent download a whole playlist with lyt?", a: "Not by default. lyt downloads one item per URL. Playlist downloads require the explicit --playlist flag." },
];

export const agents = {
  slug: "agents",
  nav: "Agents",
  title: "yt-dlp skill for Claude Code, Codex & AI agents | lyt",
  description: "Install the lyt skill for Claude Code or Codex, then run permitted yt-dlp downloads with lyt.result.v1 JSON and exact local file paths for AI agents.",
  faq,
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Agent guide</div>
      <h1>Use lyt with Claude Code, Codex, and other AI agents.</h1>
      <p class="lede">lyt lets Claude Code, Codex, and other terminal agents save permitted audio and video locally, with safe defaults and the exact file path back as JSON.</p>

      <section>
        <h2>How do I install the lyt skill for Claude Code or Codex?</h2>
        <p>Install the CLI once, then add the direct skill for the agent you use. Approve global installation before running these commands.</p>
        ${codeBlock(["npm install --global @tanattv/lyt", "lyt doctor"])}
        <p>For Claude Code, install the skill:</p>
        ${codeBlock(["lyt agent install claude"])}
        <p>For Codex, install the skill:</p>
        ${codeBlock(["lyt agent install codex"])}
        <p>To install both at once, run <code>lyt agent install all</code>.</p>
        <p>Claude Code loads the skill from <code>~/.claude/skills/lyt/</code>. Codex loads it from <code>~/.agents/skills/lyt/</code>. Run the installer again after upgrading. It does not delete older or custom skill copies.</p>
        <p>Installing a skill makes it available. The agent decides when to use it based on the task and its configuration, so name lyt in your prompt when you want certainty.</p>
      </section>

      <section>
        <h2>Can I install lyt as a Claude Code or Codex plugin?</h2>
        <p>Yes. Compatible Codex and Claude Code versions can install the plugin packages published in this repository. Use the marketplace path instead of the direct skill if your agent version supports it.</p>
        ${codeBlock(["codex plugin marketplace add TanaTTV/lyt", "codex plugin add lyt@lyt-plugins"])}
        ${codeBlock(["claude plugin marketplace add TanaTTV/lyt", "claude plugin install lyt@lyt-plugins"])}
      </section>

      <section>
        <h2>What should I ask Claude Code or Codex to do?</h2>
        <p>Name the media, the format, and the limit. Replace URL with a link you have the rights to use.</p>
        <blockquote>This is my upload. Save the audio from this URL as a 192 kbps MP3 and tell me where it was saved.</blockquote>
        <blockquote>This is my video. Download it at up to 1080p, keep it under 100 MB, and give me the saved path.</blockquote>
        <blockquote>From my video, save only 00:10 through 00:20 at up to 720p and report the final file path.</blockquote>
        <p>Each request maps to one bounded command. The agent runs it with <code>--json</code> and reads the result.</p>
      </section>

      <section>
        <h2>What does the lyt JSON result look like?</h2>
        <p>Add <code>--json</code> and lyt writes one <code>lyt.result.v1</code> document to stdout. Progress and setup diagnostics go to stderr, so a parser never has to scrape terminal text.</p>
        ${codeBlock(['lyt --mp3 -q 192K --max-filesize 100M --json "URL"'])}
        <p>Check <code>ok</code> and the exit status first. Then read <code>results[].files</code> and report those exact paths. Illustrative result:</p>
        <div class="code-block"><pre><code>${esc(resultExample)}</code></pre></div>
        <p>A dry run proves planning, not a saved file. Verify that the reported path exists before you tell the user the download finished.</p>
      </section>

      <section>
        <h2>How can an agent inspect a URL and the CLI before downloading?</h2>
        <p>Inspection returns metadata and formats without downloading media. With <code>--no-download</code> it also skips managed tool setup. Discover the CLI surface once per session instead of parsing help text.</p>
        ${codeBlock(['lyt info --no-download --json "URL"'])}
        ${codeBlock(["lyt capabilities --json"])}
        ${codeBlock(["lyt doctor --json"])}
        <p><code>lyt.info.v1</code> describes what a URL offers. <code>lyt capabilities --json</code> returns <code>lyt.capabilities.v1</code>, the commands, flags, and schemas. <code>lyt doctor --json</code> describes the local environment.</p>
      </section>

      <section>
        <h2>Can Gemini CLI or ChatGPT use lyt?</h2>
        <p>Gemini CLI and any other terminal-capable agent can run the installed lyt CLI through its shell tool. No skill is required, but the same JSON flags apply.</p>
        <p>ChatGPT can read the product facts on the <a href="../ai/">AI facts page</a>. It can run lyt on your machine only through a connected local tool.</p>
      </section>

      <section>
        <h2>What safety defaults do agents get for free?</h2>
        <ul class="check-list">
          <li>One item per URL. Playlist downloads need <code>--playlist</code>.</li>
          <li>Existing final files are preserved. Overwrites need <code>--force-overwrite</code>.</li>
          <li><code>--dry-run</code> plans a job without downloading media or installing tools.</li>
          <li><code>--max-filesize</code> skips media larger than your limit and reports why.</li>
          <li>Local history avoids repeat downloads unless you pass <code>--redownload</code>.</li>
          <li>Browser cookies, external downloaders, and SponsorBlock stay off unless you enable them.</li>
        </ul>
      </section>

      <section class="callout">
        <h2>Permission-first rule for agents</h2>
        <p>Download only media you own, have permission or a license to use, public-domain works, or media covered by an applicable exception. lyt does not bypass DRM, paywalls, or access controls. If global installation or managed tool setup has not been approved in the conversation, ask once before running it.</p>
      </section>

      <section>
        <h2>Which guide fits my task?</h2>
        <div class="recipe-grid">
          <article><span>Audio with Codex</span><a href="../codex-audio/">Download audio with Codex</a></article>
          <article><span>Video with Claude Code</span><a href="../claude-video/">Save video with Claude Code</a></article>
          <article><span>Clips with any agent</span><a href="../agent-clips/">Extract a clip with an agent</a></article>
        </div>
      </section>

      ${renderFaq(faq)}

      <div class="page-actions"><a class="button primary" href="../install/">Install lyt first</a><a class="button secondary" href="https://github.com/TanaTTV/lyt/tree/main/plugins/lyt">Inspect the plugin</a></div>
    </main>`
};
