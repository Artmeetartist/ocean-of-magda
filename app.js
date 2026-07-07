// ------------------------------------------------------------------ //
// Ocean of Magda — static (browser-only) build for GitHub Pages
//
// No backend. Search hits the Gutendex API directly (it allows CORS).
// Downloads link straight to Project Gutenberg. Reading is done fully in
// the browser with epub.js on an EPUB you open from your own device
// (Gutenberg blocks cross-origin reads, so books can't be streamed in).
// ------------------------------------------------------------------ //
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const GUTENDEX = "https://gutendex.com/books";
const state = { query: "", topic: "", language: "", sort: "popular", page: 1, hasNext: false, loading: false };

// ------------------------------------------------------------------ //
// Toasts
// ------------------------------------------------------------------ //
function toast(msg, isErr = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isErr ? " err" : "");
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

// ------------------------------------------------------------------ //
// Search (Gutendex, direct from the browser)
// ------------------------------------------------------------------ //
const FORMAT_PRIORITY = [
  ["application/epub+zip", "EPUB", true],
  ["application/pdf", "PDF", true],
  ["application/x-mobipocket-ebook", "Kindle", false],
  ["text/plain", "Text", false],
];

function flipAuthor(name) {
  if (name.includes(",")) {
    const [last, first] = name.split(",", 2).map((s) => s.trim());
    if (first) return `${first} ${last}`;
  }
  return name;
}

function normalize(book) {
  const formats = book.formats || {};
  const cover = Object.entries(formats).find(([k]) => k.startsWith("image/"));
  const pick = [];
  for (const [mime, label, primary] of FORMAT_PRIORITY) {
    const hit = Object.entries(formats).find(
      ([k, url]) => k.startsWith(mime) && !url.toLowerCase().includes(".zip")
    );
    if (hit) pick.push({ label, url: hit[1], primary });
  }
  const html = Object.entries(formats).find(
    ([k, url]) => k.startsWith("text/html") && !url.toLowerCase().includes(".zip")
  );
  return {
    id: book.id,
    title: book.title || "Untitled",
    authors: (book.authors || []).map((a) => flipAuthor(a.name || "")).filter(Boolean),
    downloads: book.download_count || 0,
    cover: cover ? cover[1] : "",
    formats: pick,
    readOnline: html ? html[1] : "",
  };
}

$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.query = $("#searchInput").value.trim();
  state.topic = "";
  setActiveCat("");
  state.page = 1;
  runSearch(true);
});
$("#loadMore").addEventListener("click", () => {
  state.page += 1;
  runSearch(false);
});

// --- Smart filters: sort, language, category, author ---
$$("#sortSeg .seg-btn").forEach((b) =>
  b.addEventListener("click", () => {
    if (state.sort === b.dataset.sort) return;
    $$("#sortSeg .seg-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.sort = b.dataset.sort;
    state.page = 1;
    runSearch(true);
  })
);
$("#langSelect").addEventListener("change", (e) => {
  state.language = e.target.value;
  state.page = 1;
  runSearch(true);
});
$$("#catRow .cat").forEach((b) =>
  b.addEventListener("click", () => {
    setActiveCat(b.dataset.topic);
    state.topic = b.dataset.topic;
    state.query = "";
    $("#searchInput").value = "";
    state.page = 1;
    runSearch(true);
  })
);
$("#results").addEventListener("click", (e) => {
  const link = e.target.closest(".author-link");
  if (link) {
    e.preventDefault();
    filterByAuthor(link.dataset.author);
  }
});

function setActiveCat(topic) {
  $$("#catRow .cat").forEach((x) => x.classList.toggle("active", x.dataset.topic === topic));
}
function filterByAuthor(name) {
  $("#searchInput").value = name;
  state.query = name;
  state.topic = "";
  setActiveCat("");
  state.page = 1;
  runSearch(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function catLabel(topic) {
  const b = $(`#catRow .cat[data-topic="${topic}"]`);
  return b ? b.textContent : topic;
}
function langLabel(code) {
  const o = $(`#langSelect option[value="${code}"]`);
  return o ? o.textContent : code;
}
function updateMeta(count) {
  const chips = [];
  if (state.query) chips.push(`“${state.query}”`);
  else if (state.topic) chips.push(catLabel(state.topic));
  if (state.language) chips.push(langLabel(state.language));
  chips.push(state.sort === "descending" ? "newest first" : "most popular");
  $("#resultMeta").textContent = `${numberFmt(count)} book${count === 1 ? "" : "s"} — ${chips.join(" · ")}`;
}

let searchSeq = 0;
async function runSearch(reset) {
  if (!reset && state.loading) return; // don't stack pagination requests
  const seq = ++searchSeq; // newer filter/search selections supersede older ones
  state.loading = true;
  const grid = $("#results");
  $("#loadMore").classList.add("hidden");
  if (reset) {
    grid.innerHTML = skeletons(8);
    $("#resultMeta").textContent = state.query ? `Searching for “${state.query}”…` : "Loading…";
  }
  try {
    const params = new URLSearchParams({ page: state.page, sort: state.sort });
    if (state.query) params.set("search", state.query);
    if (state.topic) params.set("topic", state.topic);
    if (state.language) params.set("languages", state.language);
    const res = await fetch(`${GUTENDEX}?${params}`);
    if (seq !== searchSeq) return; // a newer selection is in flight — drop this one
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const data = await res.json();
    if (seq !== searchSeq) return;

    if (reset) grid.innerHTML = "";
    const results = (data.results || []).map(normalize);
    if (reset && results.length === 0) {
      const what = state.query
        ? `“${escapeHtml(state.query)}”`
        : (state.topic ? catLabel(state.topic) : "these filters") + (state.language ? ` in ${langLabel(state.language)}` : "");
      grid.innerHTML = `<p class="empty" style="grid-column:1/-1">No books found for ${what}. Try another filter.</p>`;
    }
    results.forEach((b) => grid.appendChild(bookCard(b)));

    state.hasNext = Boolean(data.next);
    $("#loadMore").classList.toggle("hidden", !state.hasNext);
    updateMeta(data.count);
  } catch (err) {
    if (seq !== searchSeq) return;
    toast(err.message || "Search failed", true);
    if (reset) grid.innerHTML = `<p class="empty" style="grid-column:1/-1">${escapeHtml(err.message || "Search failed")}</p>`;
  } finally {
    if (seq === searchSeq) state.loading = false;
  }
}

// ------------------------------------------------------------------ //
// Cards
// ------------------------------------------------------------------ //
function bookCard(book) {
  const card = document.createElement("article");
  card.className = "card";
  const cover = book.cover
    ? `<img loading="lazy" src="${book.cover}" alt="" onerror="this.replaceWith(coverFallback('${escapeAttr(book.title)}'))">`
    : coverFallback(book.title).outerHTML;

  card.innerHTML = `
    <div class="cover-wrap">
      ${cover}
      <span class="downloads-pill" title="Downloads on Project Gutenberg">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 21h16"/></svg>
        ${numberFmt(book.downloads)}
      </span>
    </div>
    <div class="card-body">
      <h3 class="card-title" title="${escapeAttr(book.title)}">${escapeHtml(book.title)}</h3>
      <p class="card-author">${book.authors.length ? book.authors.map((a) => `<button type="button" class="author-link" data-author="${escapeAttr(a)}">${escapeHtml(a)}</button>`).join(", ") : "Unknown"}</p>
      <div class="formats"></div>
    </div>`;

  const formats = $(".formats", card);
  book.formats.forEach((f) => {
    const a = document.createElement("a");
    a.className = "chip" + (f.primary ? " primary" : "");
    a.href = f.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("download", "");
    a.innerHTML = `<span class="dl">⬇</span>${f.label}`;
    formats.appendChild(a);
  });
  if (book.readOnline) {
    const r = document.createElement("a");
    r.className = "chip read";
    r.href = book.readOnline;
    r.target = "_blank";
    r.rel = "noopener";
    r.textContent = "Read online ↗";
    formats.appendChild(r);
  }
  return card;
}

function coverFallback(title) {
  const div = document.createElement("div");
  div.className = "cover-fallback";
  div.textContent = title;
  return div;
}
window.coverFallback = coverFallback;

// ------------------------------------------------------------------ //
// Open a local EPUB (file picker + drag & drop)
// ------------------------------------------------------------------ //
$("#openEpubBtn").addEventListener("click", () => $("#epubFile").click());
$("#epubFile").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) openLocalEpub(file);
  e.target.value = "";
});

const dropZone = $("#dropZone");
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
  dragDepth++;
  dropZone.classList.remove("hidden");
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropZone.classList.add("hidden");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropZone.classList.add("hidden");
  const file = e.dataTransfer?.files && e.dataTransfer.files[0];
  if (!file) return;
  if (!/\.epub$/i.test(file.name)) {
    toast("That's not an EPUB. Download an EPUB, then drop it here.", true);
    return;
  }
  openLocalEpub(file);
});

function openLocalEpub(file) {
  const reader = new FileReader();
  reader.onload = () => openReader(reader.result, file.name.replace(/\.epub$/i, ""), file.name);
  reader.onerror = () => toast("Could not read that file", true);
  reader.readAsArrayBuffer(file);
}

// ------------------------------------------------------------------ //
// Reader (epub.js on an in-memory book)
// ------------------------------------------------------------------ //
let _book = null;
let _rendition = null;
let _bookData = null;
let _readerKey = null;
let _locReady = false;
let _curCfi = null;

const READER_DEFAULTS = { theme: "light", size: 100, line: 1.6, font: "serif", flow: "paginated" };
let prefs = loadPrefs();
const THEME_COLORS = {
  light: { bg: "#ffffff", fg: "#1c1b19", link: "#e5397f" },
  sepia: { bg: "#f6eede", fg: "#59463a", link: "#b0532a" },
  night: { bg: "#14151c", fg: "#c7ccd6", link: "#ff8cc1" },
};

function loadPrefs() {
  try { return { ...READER_DEFAULTS, ...JSON.parse(localStorage.getItem("readerPrefs") || "{}") }; }
  catch { return { ...READER_DEFAULTS }; }
}
function savePrefs() { localStorage.setItem("readerPrefs", JSON.stringify(prefs)); }
function fontStack(f) {
  return f === "sans"
    ? "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    : "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
}

function openReader(dataOrBuffer, title, key) {
  if (typeof ePub === "undefined") { toast("Reader library didn't load", true); return; }
  _bookData = dataOrBuffer;
  _readerKey = "pos:" + (key || title);
  _locReady = false;
  _curCfi = null;
  $("#readerTitle").textContent = title;
  $("#readerViewport").innerHTML = "";
  $("#readerTocPanel").classList.add("hidden");
  $("#readerSettings").classList.add("hidden");
  $("#readerScrub").disabled = true;
  $("#readerScrub").value = 0;
  $("#readerPercent").textContent = "0%";
  $("#readerLoc").textContent = "Opening…";
  syncPrefUI();

  const reader = $("#reader");
  reader.setAttribute("data-mode", "epub");
  reader.classList.remove("hidden");
  reader.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderBook();
}

function renderBook() {
  if (!_bookData) return;
  try { _rendition && _rendition.destroy(); } catch {}
  try { _book && _book.destroy(); } catch {}
  try {
    _book = ePub(_bookData);
    const opts = { width: "100%", height: "100%", flow: prefs.flow };
    if (prefs.flow === "paginated") opts.spread = "auto";
    _rendition = _book.renderTo("readerViewport", opts);
    applyReaderTheme();
    const savedCfi = localStorage.getItem(_readerKey) || undefined;
    _rendition.display(savedCfi);
    _rendition.on("relocated", onRelocated);
    _rendition.on("keyup", readerKey);
    _book.loaded.navigation.then(buildToc);
    _book.ready
      .then(() => _book.locations.generate(1200))
      .then(() => { _locReady = true; $("#readerScrub").disabled = false; if (_curCfi) updateProgress(_curCfi); })
      .catch(() => {});
  } catch (err) {
    toast("Could not open reader: " + (err.message || err), true);
    closeReader();
  }
}

function onRelocated(loc) {
  _curCfi = loc.start.cfi;
  if (_readerKey) localStorage.setItem(_readerKey, _curCfi);
  if (loc.start.displayed && prefs.flow === "paginated") {
    $("#readerLoc").textContent = `Page ${loc.start.displayed.page} / ${loc.start.displayed.total} in chapter`;
  } else {
    $("#readerLoc").textContent = "";
  }
  updateProgress(_curCfi);
}

function updateProgress(cfi) {
  if (!_locReady || !_book || !_book.locations) return;
  let pct = _book.locations.percentageFromCfi(cfi);
  if (pct == null || isNaN(pct)) return;
  pct = Math.max(0, Math.min(1, pct)) * 100;
  $("#readerScrub").value = pct;
  $("#readerPercent").textContent = Math.round(pct) + "%";
}

function buildToc(nav) {
  const panel = $("#readerTocPanel");
  panel.innerHTML = "";
  (nav.toc || []).forEach((item) => {
    const a = document.createElement("a");
    a.textContent = (item.label || "").trim() || "—";
    a.href = "#";
    a.addEventListener("click", (e) => { e.preventDefault(); _rendition.display(item.href); panel.classList.add("hidden"); });
    panel.appendChild(a);
  });
}

function applyReaderTheme() {
  if (!_rendition) return;
  const c = THEME_COLORS[prefs.theme] || THEME_COLORS.light;
  _rendition.themes.default({
    body: {
      background: c.bg + " !important",
      color: c.fg + " !important",
      "font-family": fontStack(prefs.font) + " !important",
      "line-height": prefs.line + " !important",
      padding: prefs.flow === "scrolled-doc" ? "0 10px" : "0 6px",
    },
    "p, li, span, div, blockquote": { "line-height": prefs.line + " !important", color: c.fg + " !important" },
    "a, a:link, a:visited": { color: c.link + " !important" },
    "h1,h2,h3,h4,h5,h6": { color: c.fg + " !important" },
    img: { "max-width": "100% !important", height: "auto !important" },
  });
  _rendition.themes.fontSize(prefs.size + "%");
}

function closeReader() {
  try { _rendition && _rendition.destroy(); } catch {}
  try { _book && _book.destroy(); } catch {}
  _rendition = _book = _bookData = null;
  $("#readerViewport").innerHTML = "";
  const reader = $("#reader");
  reader.classList.add("hidden");
  reader.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function readerKey(e) {
  if (e.key === "ArrowLeft") _rendition && _rendition.prev();
  else if (e.key === "ArrowRight") _rendition && _rendition.next();
  else if (e.key === "Escape") closeReader();
}

// --- Preferences UI ---
function syncPrefUI() {
  $("#reader").setAttribute("data-theme", prefs.theme);
  $$("#rsThemes .rs-theme").forEach((b) => b.classList.toggle("active", b.dataset.theme === prefs.theme));
  $("#rsSizeVal").textContent = prefs.size + "%";
  $("#rsLineVal").textContent = prefs.line.toFixed(1);
  $$("#rsFont .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.font === prefs.font));
  $$("#rsFlow .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.flow === prefs.flow));
}
$$("#rsThemes .rs-theme").forEach((b) => b.addEventListener("click", () => { prefs.theme = b.dataset.theme; savePrefs(); syncPrefUI(); applyReaderTheme(); }));
$$("#rsFont .seg-btn").forEach((b) => b.addEventListener("click", () => { prefs.font = b.dataset.font; savePrefs(); syncPrefUI(); applyReaderTheme(); }));
$$("#rsFlow .seg-btn").forEach((b) => b.addEventListener("click", () => {
  if (prefs.flow === b.dataset.flow) return;
  prefs.flow = b.dataset.flow; savePrefs(); syncPrefUI();
  _locReady = false; $("#readerScrub").disabled = true; renderBook();
}));
$("#rsSizeUp").addEventListener("click", () => setSize(prefs.size + 10));
$("#rsSizeDown").addEventListener("click", () => setSize(prefs.size - 10));
function setSize(v) { prefs.size = Math.max(70, Math.min(200, v)); savePrefs(); syncPrefUI(); applyReaderTheme(); }
$("#rsLineUp").addEventListener("click", () => setLine(prefs.line + 0.1));
$("#rsLineDown").addEventListener("click", () => setLine(prefs.line - 0.1));
function setLine(v) { prefs.line = Math.round(Math.max(1.2, Math.min(2.4, v)) * 10) / 10; savePrefs(); syncPrefUI(); applyReaderTheme(); }

$("#readerSettingsBtn").addEventListener("click", (e) => { e.stopPropagation(); $("#readerSettings").classList.toggle("hidden"); });
document.addEventListener("click", (e) => {
  const s = $("#readerSettings");
  if (s && !s.classList.contains("hidden") && !s.contains(e.target) && e.target !== $("#readerSettingsBtn")) s.classList.add("hidden");
});

$("#readerPrev").addEventListener("click", () => _rendition && _rendition.prev());
$("#readerNext").addEventListener("click", () => _rendition && _rendition.next());
$("#readerClose").addEventListener("click", closeReader);
$("#readerToc").addEventListener("click", () => $("#readerTocPanel").classList.toggle("hidden"));
$("#readerScrub").addEventListener("input", (e) => { $("#readerPercent").textContent = Math.round(e.target.value) + "%"; });
$("#readerScrub").addEventListener("change", (e) => {
  if (!_locReady || !_book) return;
  const cfi = _book.locations.cfiFromPercentage(parseFloat(e.target.value) / 100);
  if (cfi) _rendition.display(cfi);
});
document.addEventListener("keyup", (e) => { if (!$("#reader").classList.contains("hidden")) readerKey(e); });

// ------------------------------------------------------------------ //
// Helpers
// ------------------------------------------------------------------ //
function skeletons(n) {
  return Array.from({ length: n })
    .map(() => `<div class="skel"><div class="cover-wrap"></div><div class="skel-line"></div><div class="skel-line short"></div></div>`)
    .join("");
}
function numberFmt(n) {
  if (n == null) return "0";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s = "") { return escapeHtml(s).replace(/'/g, "\\'"); }

// ------------------------------------------------------------------ //
// Boot
// ------------------------------------------------------------------ //
runSearch(true);
