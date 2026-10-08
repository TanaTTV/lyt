import { renderFaq } from "../components.mjs";

const faq = [
  {
    q: "Is lyt a yt-dlp GUI?",
    a: "No. lyt is a command-line tool with no window. It runs yt-dlp and ffmpeg for you and adds presets, safer defaults, and a JSON result. The repository has an experimental desktop prototype, but it is not part of the released package."
  },
  {
    q: "Does lyt replace yt-dlp?",
    a: "No. lyt calls yt-dlp to do the downloading, so you keep yt-dlp's extractors and engine. You can run yt-dlp directly at any time, and lyt does not change how yt-dlp itself works."
  },
  {
    q: "Does lyt support every yt-dlp option?",
    a: "No. lyt exposes a smaller set of flags on purpose. Run lyt capabilities --json to see the commands, flags, and result schemas it supports. For anything else, use yt-dlp directly."
  },
  {
    q: "Which should a beginner use?",
    a: "Start with lyt if you want MP3 or 1080p presets, a managed yt-dlp install, and single-item safety by default. Learn yt-dlp directly if you want its full option set or you are following a guide written for it."
  },
  {
    q: "Does lyt work on the same sites as yt-dlp?",
    a: "For single items, lyt hands the URL to yt-dlp, so sites yt-dlp supports generally work. The README lists SoundCloud, Vimeo, Bandcamp, and anything yt-dlp supports. Spotify links are a lyt feature: lyt matches each track on YouTube and does not download Spotify audio."
  }
];

export const ytDlpEasy = {
  slug: "yt-dlp-easy",
  nav: "Compare",
  title: "lyt vs yt-dlp — when a simpler CLI helps",
  description: "An honest comparison of lyt and yt-dlp: what lyt adds on top of yt-dlp, when to use yt-dlp directly, and which tool fits your downloads.",
  faq,
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Comparison</div>
      <h1>lyt is built on yt-dlp. It is not a replacement.</h1>
      <p class="lede">lyt wraps yt-dlp and ffmpeg with memorable presets, a safer single-item default, and a stable JSON result. yt-dlp has far more options and a much larger community. Pick the tool that matches the job.</p>

      <section>
        <h2>At a glance</h2>
        <div class="compare-wrap">
          <table class="compare-table">
            <thead>
              <tr><th>Need</th><th>yt-dlp</th><th class="us">lyt</th></tr>
            </thead>
            <tbody>
              <tr><td>Option coverage</td><td><span class="yes">Full option set</span></td><td class="us"><span class="meh">Common subset of flags</span></td></tr>
              <tr><td>MP3 and 1080p presets</td><td><span class="meh">Build the flags yourself</span></td><td class="us"><span class="yes">Built in: -q 192K, -q 1080p</span></td></tr>
              <tr><td>Getting yt-dlp</td><td><span class="meh">Install and update it yourself</span></td><td class="us"><span class="yes">Checksum-verified managed copy from lyt doctor --fix</span></td></tr>
              <tr><td>ffmpeg setup</td><td><span class="meh">Install it and point to it yourself</span></td><td class="us"><span class="yes">Provisioned on Windows; guided on macOS and Linux</span></td></tr>
              <tr><td>Playlist links</td><td><span class="meh">Downloads every item unless you add --no-playlist</span></td><td class="us"><span class="yes">One item unless you add --playlist</span></td></tr>
              <tr><td>Machine-readable result</td><td><span class="meh">Build your own output with --print or -J</span></td><td class="us"><span class="yes">lyt.result.v1 JSON with final file paths</span></td></tr>
              <tr><td>Site and extractor breadth</td><td><span class="yes">Very broad, large community</span></td><td class="us"><span class="meh">Inherits yt-dlp's sites; newer project at 0.8.x</span></td></tr>
              <tr><td>Runtime</td><td><span class="yes">Standalone program, no Node.js</span></td><td class="us"><span class="meh">Needs Node.js 20 or newer</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="callout">
        <h2>Use yt-dlp directly when</h2>
        <ul class="check-list">
          <li>You need an option lyt does not expose, or you want yt-dlp's full format selector and extractor arguments.</li>
          <li>You already have a working yt-dlp setup and config, and there is no reason to change it.</li>
          <li>You want one standalone program and do not want Node.js involved.</li>
          <li>You are following a tutorial or yt-dlp documentation, and exact flag names matter.</li>
        </ul>
      </section>

      <section>
        <h2>Use lyt when</h2>
        <ul class="check-list">
          <li>You want MP3 or 1080p downloads without remembering flags.</li>
          <li>You want one item per run by default, with playlists opt-in.</li>
          <li>An agent or script needs one JSON document with the final file paths.</li>
          <li>You are setting up on Windows and want yt-dlp and ffmpeg managed for you.</li>
        </ul>
      </section>

      <section>
        <h2>Same job, two commands</h2>
        <p>Each pair does the same job. The yt-dlp flags are the common ones; check the yt-dlp documentation for details.</p>
        <div class="recipe-grid">
          <article>
            <span>MP3 at 192K</span>
            <code>yt-dlp -x --audio-format mp3 --audio-quality 192K "URL"</code>
            <button class="copy" data-copy="yt-dlp -x --audio-format mp3 --audio-quality 192K &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button>
            <code>lyt --mp3 -q 192K "URL"</code>
            <button class="copy" data-copy="lyt --mp3 -q 192K &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button>
          </article>
          <article>
            <span>1080p video</span>
            <code>yt-dlp -f "bv*[height&lt;=1080]+ba/b[height&lt;=1080]" --merge-output-format mp4 "URL"</code>
            <button class="copy" data-copy="yt-dlp -f &quot;bv*[height&lt;=1080]+ba/b[height&lt;=1080]&quot; --merge-output-format mp4 &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button>
            <code>lyt --video -q 1080p "URL"</code>
            <button class="copy" data-copy="lyt --video -q 1080p &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button>
          </article>
          <article>
            <span>Save to a folder</span>
            <code>yt-dlp -P "D:/Music" -x --audio-format mp3 "URL"</code>
            <button class="copy" data-copy="yt-dlp -P &quot;D:/Music&quot; -x --audio-format mp3 &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button>
            <code>lyt --mp3 -o "D:/Music" "URL"</code>
            <button class="copy" data-copy="lyt --mp3 -o &quot;D:/Music&quot; &quot;URL&quot;" aria-live="polite"><span class="copy-label">Copy</span></button>
          </article>
        </div>
      </section>

      ${renderFaq(faq)}

      <div class="page-actions">
        <a class="button primary" href="../install/">Try lyt</a>
        <a class="button secondary" href="https://github.com/yt-dlp/yt-dlp">Read the yt-dlp docs</a>
      </div>
    </main>`
};
