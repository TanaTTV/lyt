// Progressive enhancement only: every page is complete without this script.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Copy buttons -------------------------------------------------------------
for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const label = button.querySelector(".copy-label");
    const original = label ? label.textContent : button.textContent;
    const set = (text) => { if (label) label.textContent = text; else button.textContent = text; };
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      set("Copied");
      button.classList.add("copied");
    } catch {
      set("Copy failed");
    }
    window.setTimeout(() => { set(original); button.classList.remove("copied"); }, 1600);
  });
}

// JSON examples: color keys, strings, and literals --------------------------
for (const code of document.querySelectorAll(".json code, .json:not(:has(code)), .code-block code, .mini")) {
  const text = code.textContent;
  if (!/^\s*[{[]/.test(text) || code.querySelector("span")) continue;
  code.innerHTML = escapeHtml(text).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g,
    (match, str, colon, literal, number) => {
      if (str) return colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`;
      return `<span class="b">${literal ?? number}</span>`;
    },
  );
  code.classList.add("json-hl");
}

// Header: border once scrolled, mobile menu toggle -------------------------
const header = document.querySelector(".site-header");
const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("nav-links");
if (toggle && links) {
  const setOpen = (open) => {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  setOpen(false);

  toggle.addEventListener("click", () => setOpen(!links.classList.contains("open")));
  links.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  // Escape closes the menu and returns focus to the toggle.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && links.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  // A click or tap anywhere outside the header closes the open menu.
  document.addEventListener("click", (event) => {
    if (links.classList.contains("open") && !event.target.closest(".site-header")) setOpen(false);
  });
  // Leaving the mobile layout clears the open state so desktop nav is never hidden.
  window.matchMedia("(min-width: 821px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

// Reveal on scroll ----------------------------------------------------------
const revealables = document.querySelectorAll(".reveal");
if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  revealables.forEach((element) => observer.observe(element));
} else {
  revealables.forEach((element) => element.classList.add("in"));
}

// Terminal demo: tabs + typed commands --------------------------------------
const terminal = document.querySelector("[data-terminal]");
if (terminal) {
  const tabs = [...terminal.querySelectorAll("[role=tab]")];
  const panes = [...terminal.querySelectorAll("[role=tabpanel]")];
  let run = 0;
  let autoplay = !reduceMotion;
  let autoTimer = null;

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function play(pane) {
    const id = ++run;
    const lines = [...pane.querySelectorAll(".ln")];
    if (reduceMotion) return;
    terminal.classList.add("js-anim");
    lines.forEach((line) => line.classList.add("pending"));

    for (const line of lines) {
      if (id !== run) return;
      line.classList.remove("pending");

      if (line.classList.contains("cmd")) {
        // Type the command text, then restore its colored markup.
        const html = line.innerHTML;
        const text = line.textContent;
        const prompt = line.dataset.prompt ?? "$ ";
        line.classList.add("typing");
        for (let i = prompt.length; i <= text.length; i += 1) {
          if (id !== run) { line.innerHTML = html; return; }
          line.innerHTML = `<span class="t-muted">${prompt}</span>${escapeHtml(text.slice(prompt.length, i))}<span class="cursor"></span>`;
          await sleep(text.length > 48 ? 14 : 24);
        }
        line.innerHTML = html;
        line.classList.remove("typing");
        await sleep(380);
      } else {
        const bar = line.querySelector(".t-bar");
        if (bar) {
          for (let fill = 0; fill <= 100; fill += 5) {
            if (id !== run) return;
            bar.style.setProperty("--fill", `${fill}%`);
            await sleep(18);
          }
        }
        await sleep(line.classList.contains("gap") ? 60 : 140);
      }
    }

    if (autoplay && id === run) {
      autoTimer = window.setTimeout(() => select((tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true") + 1) % tabs.length), 3400);
    }
  }

  function select(index, { user = false } = {}) {
    if (user) autoplay = false;
    window.clearTimeout(autoTimer);
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panes[i].hidden = !active;
    });
    play(panes[index]);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index, { user: true }));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const next = (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
      select(next, { user: true });
      tabs[next].focus();
    });
  });

  // Start when the terminal scrolls into view.
  if ("IntersectionObserver" in window) {
    const once = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        once.disconnect();
        select(0);
      }
    }, { threshold: 0.3 });
    once.observe(terminal);
  }
}

// Commands page: filter + section highlight ---------------------------------
const search = document.querySelector("[data-ref-search]");
if (search) {
  const groups = [...document.querySelectorAll(".ref-group")];
  const empty = document.querySelector(".no-results");
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const group of groups) {
      let groupShown = 0;
      for (const recipe of group.querySelectorAll(".recipe")) {
        const match = !query || recipe.textContent.toLowerCase().includes(query) || group.querySelector("h2").textContent.toLowerCase().includes(query);
        recipe.classList.toggle("hidden-by-search", !match);
        if (match) groupShown += 1;
      }
      group.classList.toggle("hidden-by-search", groupShown === 0);
      shown += groupShown;
    }
    empty?.classList.toggle("show", shown === 0);
  });
}

const refLinks = [...document.querySelectorAll(".ref-nav a[href^='#']")];
if (refLinks.length > 0 && "IntersectionObserver" in window) {
  const byId = new Map(refLinks.map((link) => [link.getAttribute("href").slice(1), link]));
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        refLinks.forEach((link) => link.classList.remove("active"));
        byId.get(entry.target.id)?.classList.add("active");
      }
    }
  }, { rootMargin: "-20% 0px -70% 0px" });
  byId.forEach((_, id) => { const section = document.getElementById(id); if (section) spy.observe(section); });
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
