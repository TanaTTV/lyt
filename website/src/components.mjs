// Shared markup helpers used by page modules.
// A page may export `faq: [{ q, a }]` (plain text). build.mjs turns it into
// FAQPage JSON-LD, and the page body renders it visibly with renderFaq().

export function renderFaq(faq, { heading = "Frequently asked questions", kicker = "FAQ" } = {}) {
  const items = faq.map(({ q, a }) => `
          <details><summary>${escapeHtml(q)}</summary><div><p>${escapeHtml(a)}</p></div></details>`).join("");
  return `
      <section class="section shell" id="faq">
        <div class="section-head center"><div class="kicker">${kicker}</div><h2>${heading}</h2></div>
        <div class="faq">${items}
        </div>
      </section>`;
}

// A copyable command block. `lines` are plain text; build.mjs normalizes the
// copy button markup site-wide.
export function codeBlock(lines) {
  const text = (Array.isArray(lines) ? lines : [lines]).join("\n");
  return `<div class="code-block"><pre><code>${escapeHtml(text)}</code></pre><button class="copy" type="button" data-copy="${escapeHtml(text).replaceAll("\n", "&#10;")}"><span class="copy-label">Copy</span></button></div>`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
