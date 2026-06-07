// Backend abstraction. Inside Tauri we call the Rust commands; in a plain
// browser we serve mock data so the UI can be designed and screenshotted
// without a full build.

export const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;

const tauri = IS_TAURI ? window.__TAURI__ : null;

const tauriApi = {
  search: (query) => tauri.core.invoke("search", { query }),
  resolve: (url) => tauri.core.invoke("resolve", { url }),
  pickFolder: () => tauri.dialog.open({ directory: true }),

  async download(opts, onUpdate) {
    const id = await tauri.core.invoke("start_download", opts);
    const unlisten = await tauri.event.listen(`progress:${id}`, (event) => {
      onUpdate(event.payload);
      if (event.payload.status === "done" || event.payload.status === "error") {
        unlisten();
      }
    });
    return id;
  },

  seedDownloads() {}, // real app starts with an empty queue
};

// ---------- Mock backend (browser dev / screenshots) ----------
const SAMPLE = [
  { title: "lofi hip hop radio 📚 beats to relax/study to", channel: "Lofi Girl", duration: "3:14:09", views: "1.2M watching" },
  { title: "Chillhop Essentials · Autumn 2024 [jazzy / lofi hip hop]", channel: "Chillhop Music", duration: "1:02:51", views: "4.3M views" },
  { title: "Deep Focus — Music to Improve Concentration", channel: "Quiet Quest", duration: "2:48:30", views: "812K views" },
  { title: "Coding Mix: Synthwave & Chill for Late-Night Sessions", channel: "Nightdrive FM", duration: "58:17", views: "236K views" },
  { title: "Rainy Jazz Café — Slow Piano & Coffee Shop Ambience", channel: "Cozy Sounds", duration: "1:45:02", views: "2.0M views" },
];

const mockApi = {
  async search(query) {
    await delay(450);
    return SAMPLE.map((item, i) => ({
      ...item,
      url: `https://www.youtube.com/watch?v=demo${i}`,
      thumbnail: null,
    }));
  },

  async resolve(url) {
    await delay(300);
    return [{
      title: "Pasted link — single video",
      channel: "youtube.com",
      duration: "4:21",
      views: "",
      url,
      thumbnail: null,
    }];
  },

  async pickFolder(current) {
    await delay(150);
    return current === "~/Downloads" ? "~/Music/lyt" : "~/Downloads";
  },

  download(_opts, onUpdate) {
    let pct = 0;
    onUpdate({ percent: 0, detail: "starting…", status: "downloading" });
    const timer = setInterval(() => {
      pct = Math.min(100, pct + 6 + Math.random() * 12);
      if (pct >= 100) {
        clearInterval(timer);
        onUpdate({ percent: 100, detail: "saved to folder", status: "done" });
      } else {
        onUpdate({ percent: pct, detail: `${(1.4 + Math.random()).toFixed(1)} MiB/s`, status: "downloading" });
      }
    }, 420);
  },

  // Pre-populate the downloads panel so the design reads well on first paint.
  seedDownloads(set) {
    set([
      { id: "seed1", title: "Deep Focus — Music to Improve Concentration", kind: "audio", percent: 64, status: "downloading", detail: "2.1 MiB/s · ETA 00:48" },
      { id: "seed2", title: "Chillhop Essentials · Autumn 2024", kind: "video", percent: 100, status: "done", detail: "saved to ~/Downloads" },
    ]);
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const api = IS_TAURI ? tauriApi : mockApi;
