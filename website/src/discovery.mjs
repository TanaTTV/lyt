import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const tasks = [
  { slug: "codex-audio", title: "Download YouTube audio with Codex and lyt", description: "Install the lyt skill for Codex, save permitted YouTube audio as MP3, and read exact local file paths from structured JSON.", agent: "codex", heading: "Save audio as MP3 with Codex.", prompt: "This is my upload. Save the audio from this URL as a 192 kbps MP3 and tell me where it was saved.", command: 'lyt --mp3 -q 192K --max-filesize 100M --json "URL"', mode: "audio", path: "/downloads/example.mp3" },
  { slug: "claude-video", title: "Download YouTube video with Claude Code and lyt", description: "Set up the lyt skill in Claude Code, download permitted video at up to 1080p, and verify final file paths with versioned JSON.", agent: "claude", heading: "Save a video with Claude Code.", prompt: "This is my video. Download it at up to 1080p, keep it under 100 MB, and give me the saved path.", command: 'lyt --video -q 1080p --max-filesize 100M --json "URL"', mode: "video", path: "/downloads/example.mp4" },
  { slug: "agent-clips", title: "Extract a video clip with Codex or Claude Code using lyt", description: "Use lyt to save a permitted video segment with Codex or Claude Code, inspect formats, limit file size, and report exact local results.", agent: "all", heading: "Extract a clip with your coding agent.", prompt: "From my video, save only 00:10 through 00:20 at up to 720p and report the final file path.", command: 'lyt --video --clip 00:10-00:20 -q 720p --max-filesize 100M --json "URL"', mode: "video", path: "/downloads/example-clip.mp4" },
];
export const discoveryPages = tasks.map((task) => {
  const example = JSON.stringify({schema: "lyt.result.v1", version, command: "download", ok: true, results: [{url: "URL", status: "downloaded", mode: task.mode, files: [task.path], outputDir: "/downloads"}]}, null, 2);
  return {slug: task.slug, title: task.title, description: task.description, body: `
    <main id="main" class="doc shell">
      <div class="kicker">Agent task guide</div><h1>${task.heading}</h1>
      <p class="lede">${task.description}</p>
      <section><h2>Install and check</h2><p>Requires Node.js 20 or newer and terminal execution. Approve global installation and managed tool setup once. Network access to the media host is required; ffmpeg is needed for MP3 conversion, video merging, and clips.</p><div class="code-block"><pre><code>npm install --global @tanattv/lyt
lyt agent install ${task.agent}
lyt doctor --json
lyt capabilities --json</code></pre></div><p>Codex user skills live in <code>~/.agents/skills/lyt/</code>; Claude Code skills live in <code>~/.claude/skills/lyt/</code>. An installed and enabled skill can be selected for matching tasks; selection depends on the agent.</p></section>
      <section><h2>Ask naturally</h2><blockquote>${task.prompt}</blockquote><p>Replace URL with your media link. Ownership, permission, licenses, public domain, or applicable exceptions can support retrieval. Downloading does not establish publication rights.</p></section>
      <section><h2>Inspect, then download</h2><div class="code-block"><pre><code>lyt info --no-download --json "URL"
${escape(task.command)}</code></pre></div><p>Inspection contacts the media host but does not download media. With <code>--no-download</code> it also avoids provisioning tools. A quality setting is a cap, not a guarantee that the source offers that resolution.</p></section>
      <section><h2>Read the result</h2><p>Illustrative success response; names and paths depend on the source and output directory. Read JSON from stdout and diagnostics from stderr. Check the exit status and <code>ok</code> before using <code>results[].files</code>.</p><div class="code-block"><pre><code>${escape(example)}</code></pre></div><p>Failure must not be reported as a saved file. Verify that successful paths exist. Playlist downloads and overwrites remain opt-in.</p></section>
      <section><h2>Troubleshoot access</h2><p>Run <code>lyt doctor --json</code> for missing tools. A certificate trust error may require correctly configuring your environment's trusted certificates. Do not disable certificate verification as a default fix. A host or network proxy may return an HTML error page instead of media, causing an invalid-input conversion error. That needs an access or network fix; lyt cannot guarantee access from a restricted agent environment.</p></section>
      <div class="page-actions"><a class="button primary" href="../agents/">Agent setup guide</a><a class="button secondary" href="../ai/">AI product facts</a></div>
    </main>`};
});
