export const privacy = {
  slug: "privacy",
  nav: null,
  title: "lyt privacy: what it sends and what stays on your machine",
  description: "What lyt sends over the network, what stays on your machine, how to turn off update checks, and how to report a security issue in lyt. No analytics.",
  body: `
    <main id="main" class="doc shell">
      <div class="kicker">Privacy</div>
      <h1>What lyt sends, and what stays on your machine.</h1>
      <p class="lede">lyt runs on your machine. It has no lyt account, no hosted service, and no product analytics. Downloads contact the media site you request, and setup contacts release sources when it installs managed tools.</p>

      <section>
        <h2>What lyt sends over the network</h2>
        <ul class="check-list">
          <li><strong>The media site.</strong> When you download, yt-dlp contacts the URL you give it and the services needed to resolve and fetch the media.</li>
          <li><strong>Managed tools.</strong> <code>lyt doctor --fix</code> and first-use installs download yt-dlp from its GitHub release and check it against the published checksum. On Windows, lyt may download a verified ffmpeg build from its GitHub release when no usable ffmpeg is found.</li>
          <li><strong>Update checks.</strong> lyt may ask npm for the latest published version of <code>@tanattv/lyt</code>. Successful checks are cached for about six hours. Turn them off with <code>lyt config set update-check false</code> or <code>LYT_NO_UPDATE_CHECK=1</code>.</li>
          <li><strong>Spotify links.</strong> lyt reads the public track list from Spotify and searches YouTube for each song. If you set your own Spotify API keys for playlists over 100 songs, lyt uses Spotify's Web API with them.</li>
          <li><strong>Cookies.</strong> Browser cookies are read only when you pass <code>--cookies-from-browser</code> or <code>--cookies</code>, and they are sent to the site you download from.</li>
          <li><strong>Network checks.</strong> <code>lyt doctor --network</code> contacts YouTube, Spotify, SoundCloud, and GitHub, and only when you run it.</li>
        </ul>
        <div class="callout">
          <h2>Requests are not anonymous</h2>
          <p>Requests come from your network address and are visible to the sites and networks they pass through. lyt cannot make those requests anonymous.</p>
        </div>
      </section>

      <section>
        <h2>What stays on your machine</h2>
        <ul class="check-list">
          <li><strong>Downloaded files</strong>, saved to the folder you choose or the default <code>downloads</code> folder.</li>
          <li><strong>Config</strong> in <code>config.json</code> inside lyt's data folder. Secrets such as Spotify API keys are stored there and masked in <code>lyt config</code> output.</li>
          <li><strong>History</strong> in <code>history.jsonl</code> inside the same folder. It records titles, uploader, site, page URL, and absolute file paths. Use <code>lyt history --clear</code> to wipe it, or <code>--no-history</code> to skip recording a run.</li>
          <li><strong>Managed tools</strong> such as yt-dlp and any managed ffmpeg. <code>lyt doctor</code> shows their exact paths.</li>
        </ul>
        <p>The data folder is <code>%LOCALAPPDATA%\\lyt</code> on Windows, <code>~/Library/Application Support/lyt</code> on macOS, and <code>$XDG_DATA_HOME/lyt</code> or <code>~/.local/share/lyt</code> on Linux.</p>
        <div class="callout">
          <h2>Check before you share</h2>
          <p>Before you send a history file, a bug report, or a screenshot, remove source URLs, local file paths, and any config values.</p>
        </div>
      </section>

      <section>
        <h2>Telemetry</h2>
        <p>lyt does not send product-usage analytics. npm download counts and GitHub traffic are published by those platforms. They do not identify lyt users or show which downloads succeeded.</p>
      </section>

      <section>
        <h2>Responsible use</h2>
        <p>Download media only when you own it, have permission or a licence, it is in the public domain, or an applicable copyright exception covers the use. Public availability does not grant download, reuse, or redistribution rights. Site terms and local law may also restrict a workflow. Do not use lyt to get around DRM, paywalls, or access controls.</p>
      </section>

      <section>
        <h2>Reporting security issues</h2>
        <p>Do not open a public issue for a vulnerability that could expose user data, run unexpected commands, overwrite files, or bypass a safety boundary. Follow the <a href="https://github.com/TanaTTV/lyt/security/policy">security policy</a> instead. Remove cookies, tokens, private media URLs, and personal file paths from any report.</p>
      </section>

      <div class="page-actions">
        <a class="button primary" href="../install/">Install lyt</a>
        <a class="button secondary" href="../commands/">Command reference</a>
      </div>
    </main>`
};
