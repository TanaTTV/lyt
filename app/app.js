// Frontend for the lyt desktop app.
//
// The UI talks to a tiny `api` layer. Inside Tauri it calls the Rust backend
// via `invoke`; in a plain browser (used for design/dev and screenshots) it
// falls back to mock data so the interface is fully viewable without a build.

import { api, IS_TAURI } from "./api.js";

const state = {
  kind: "audio", // "audio" | "video"
  quality: "best",
  folder: "~/Downloads",
  results: [],
  downloads: [],
};

const QUALITY_OPTIONS = {
  audio: [
    { value: "best", label: "Best (native)" },
    { value: "mp3-320", label: "MP3 · 320K" },
    { value: "mp3-192", label: "MP3 · 192K" },
    { value: "mp3-128", label: "MP3 · 128K" },
  ],
  video: [
    { value: "best", label: "Best available" },
    { value: "2160p", label: "4K · 2160p" },
    { value: "1440p", label: "2K · 1440p" },
    { value: "1080p", label: "1080p" },
    { value: "720p", label: "720p" },
    { value: "480p", label: "480p" },
  ],
};

const els = {
  query: document.getElementById("query"),
  searchBtn: document.getElementById("searchBtn"),
  quality: document.getElementById("quality"),
  qualityLabel: document.getElementById("qualityLabel"),
  results: document.getElementById("results"),
  downloadsList: document.getElementById("downloadsList"),
  downloadsEmpty: document.getElementById("downloadsEmpty"),
  segments: [...document.querySelectorAll(".seg")],
  folderChip: document.getElementById("folderChip"),
  folderLabel: document.getElementById("folderLabel"),
  clearDone: document.getElementById("clearDone"),
};

function setKind(kind) {
  state.kind = kind;
  state.quality = "best";
  els.segments.forEach((seg) => seg.classList.toggle("active", seg.dataset.kind === kind));
  els.qualityLabel.textContent = kind === "video" ? "Quality" : "Format";
  renderQualityOptions();
}

function renderQualityOptions() {
  els.quality.innerHTML = "";
  for (const opt of QUALITY_OPTIONS[state.kind]) {
    const node = document.createElement("option");
    node.value = opt.value;
    node.textContent = opt.label;
    els.quality.append(node);
  }
}

function looksLikeUrl(text) {
  return /^https?:\/\//i.test(text.trim());
}

async function runSearch() {
  const q = els.query.value.trim();
  if (!q) return;

  els.results.innerHTML = loadingMarkup();

  try {
    const results = looksLikeUrl(q)
      ? await api.resolve(q)
      : await api.search(q);
    state.results = results;
    renderResults();
  } catch (error) {
    els.results.innerHTML = `<div class="results-empty"><h3>Couldn't load results</h3><p>${escapeHtml(errorMessage(error))}</p></div>`;
  }
}

function renderResults() {
  if (state.results.length === 0) {
    els.results.innerHTML = emptyResultsMarkup();
    return;
  }

  els.results.innerHTML = "";
  for (const item of state.results) {
    els.results.append(resultCard(item));
  }
}

function resultCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const safeSrc = isSafeUrl(item.thumbnail) ? item.thumbnail : "";
  const thumb = safeSrc
    ? `<img src="${escapeHtml(safeSrc)}" alt="" loading="lazy" />`
    : `<div class="thumb-fallback" style="--h:${hueFor(item.title)}"></div>`;

  card.innerHTML = `
    <div class="thumb" style="--h:${hueFor(item.title)}">
      ${thumb}
      ${item.duration ? `<span class="dur">${escapeHtml(item.duration)}</span>` : ""}
    </div>
    <div class="card-info">
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <div class="card-meta">
        <span>${escapeHtml(item.channel || "")}</span>
        ${item.views ? `<span class="dot"></span><span>${escapeHtml(item.views)}</span>` : ""}
      </div>
    </div>
    <div class="card-actions">
      <button class="dl-btn">
        <svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      </button>
    </div>`;

  card.querySelector(".dl-btn").addEventListener("click", () => startDownload(item));
  return card;
}

async function startDownload(item) {
  const entry = {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: item.title,
    kind: state.kind,
    percent: 0,
    status: "downloading",
    source: item,
    request: {
      url: item.url,
      kind: state.kind,
      quality: state.quality,
      folder: state.folder,
    },
    detail: "starting…",
  };
  state.downloads.unshift(entry);
  renderDownloads();

  try {
    entry.id = await api.download(entry.request, (update) => {
      entry.percent = update.percent ?? entry.percent;
      entry.detail = update.detail ?? entry.detail;
      if (update.status) entry.status = update.status;
      renderDownloads();
    });
  } catch (error) {
    entry.status = "error";
    entry.detail = errorMessage(error);
    renderDownloads();
  }
}

function renderDownloads() {
  const active = state.downloads;
  els.downloadsEmpty.style.display = active.length ? "none" : "";

  for (const node of [...els.downloadsList.querySelectorAll(".dl-item")]) node.remove();

  for (const dl of active) {
    const item = document.createElement("div");
    item.className = `dl-item${dl.status === "done" ? " done" : ""}${dl.status === "error" ? " error" : ""}`;
    const kindIcon =
      dl.kind === "video"
        ? `<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M22 7l-6 5 6 5z"/>`
        : `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`;
    const action = dl.status === "downloading" && !String(dl.id).startsWith("pending-")
      ? `<button class="job-action" data-action="cancel">Cancel</button>`
      : ["error", "canceled"].includes(dl.status)
        ? `<button class="job-action" data-action="retry">Retry</button>`
        : "";
    item.innerHTML = `
      <div class="dl-item-top">
        <span class="dl-kind"><svg viewBox="0 0 24 24" class="ico">${kindIcon}</svg></span>
        <span class="dl-name">${escapeHtml(dl.title)}</span>
        <span class="dl-pct">${dl.status === "done" ? "Done" : dl.status === "canceled" ? "Canceled" : Math.round(dl.percent) + "%"}</span>
      </div>
      <div class="bar"><span style="width:${dl.percent}%"></span></div>
      <div class="dl-sub"><span>${escapeHtml(dl.detail)}</span><span>${dl.kind} ${action}</span></div>`;
    item.querySelector('[data-action="cancel"]')?.addEventListener("click", async () => {
      try {
        await api.cancel(dl.id);
      } catch (error) {
        dl.status = "error";
        dl.detail = errorMessage(error);
        renderDownloads();
      }
    });
    item.querySelector('[data-action="retry"]')?.addEventListener("click", () => {
      state.kind = dl.request.kind;
      state.quality = dl.request.quality;
      state.folder = dl.request.folder;
      startDownload(dl.source);
    });
    els.downloadsList.append(item);
  }
}

function hueFor(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isSafeUrl(url) {
  if (!url) return false;
  try { return ["https:", "http:"].includes(new URL(url).protocol); } catch { return false; }
}

function emptyResultsMarkup() {
  return `<div class="results-empty">
    <svg viewBox="0 0 24 24" class="big-ico"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <h3>Search or paste a link to start</h3>
    <p>Type what you're looking for, or paste a YouTube URL. Pick audio or video, choose a quality, and hit download.</p>
  </div>`;
}

function loadingMarkup() {
  return `<div class="results-empty"><h3>Searching…</h3></div>`;
}

// ---- wire up events ----
els.segments.forEach((seg) => seg.addEventListener("click", () => setKind(seg.dataset.kind)));
els.searchBtn.addEventListener("click", runSearch);
els.query.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});
els.clearDone.addEventListener("click", () => {
  state.downloads = state.downloads.filter((d) => d.status !== "done");
  renderDownloads();
});
els.folderChip.addEventListener("click", async () => {
  const picked = await api.pickFolder(state.folder);
  if (picked) {
    state.folder = picked;
    els.folderLabel.textContent = picked;
  }
});

setKind("audio");
renderResults();

// In plain-browser dev mode, seed the view so the design is visible at a glance.
if (!IS_TAURI) {
  els.query.value = "lofi hip hop";
  runSearch();
  api.seedDownloads((seed) => {
    state.downloads = seed;
    renderDownloads();
  });
}
