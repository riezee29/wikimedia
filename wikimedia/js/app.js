const $ = (id) => document.getElementById(id);
const fmt = (t) => new Date(t).toLocaleString();
const enc = encodeURIComponent;
const dec = decodeURIComponent;

let currentTitle = "Main_Page";

function setTabs(title, active) {
  const t = enc(title);
  const tab = (name, href, key) => `<a href="${href}" class="${active === key ? "active" : ""}">${name}</a>`;
  $("tabs").innerHTML =
    `<div class="group">${tab("Article", `#/wiki/${t}`, "article")}${tab(`Discussion (${Store.comments(title).length})`, `#/talk/${t}`, "talk")}</div>` +
    `<div class="group">${tab("Read", `#/wiki/${t}`, "read")}${tab("Edit", `#/edit/${t}`, "edit")}${tab("History", `#/history/${t}`, "history")}</div>`;
}

function clearTabs() { $("tabs").innerHTML = ""; }

function show(title, bodyHtml, opts = {}) {
  $("page-title").textContent = title;
  $("body").innerHTML = bodyHtml;
  $("categories").innerHTML = opts.categories || "";
  $("footer-note").textContent = opts.footer || "";
  document.title = title + " - Wikimedia";
  window.scrollTo(0, 0);
}

/* ---------- Article ---------- */
function viewArticle(title, revId, fromRedirect) {
  const key = Store.normalize(title);
  currentTitle = key;
  const page = Store.getPage(key);
  setTabs(key, revId ? "history" : "read");

  if (!page) {
    show(Store.pretty(key),
      `<div class="notice">This page does not exist yet. <a href="#/edit/${enc(key)}">Create it</a>.</div>`);
    return;
  }

  const rev = revId ? page.revisions.find(r => r.id === Number(revId)) : page.revisions[page.revisions.length - 1];
  if (!rev) { show("Revision not found", "<p>That revision does not exist.</p>"); return; }

  if (!revId) {
    const target = Markup.redirectTarget(rev.text);
    if (target && !fromRedirect) {
      history.replaceState(null, "", `#/wiki/${enc(target)}?from=${enc(key)}`);
      viewArticle(target, null, key);
      return;
    }
  }

  let html = "";
  const q = new URLSearchParams((location.hash.split("?")[1]) || "");
  if (q.get("from")) html += `<div class="notice">Redirected from ${Markup.esc(Store.pretty(q.get("from")))}</div>`;
  if (revId) html += `<div class="notice">You are viewing an old revision from ${fmt(rev.time)}. <a href="#/wiki/${enc(key)}">View current version</a></div>`;
  html += Markup.render(rev.text);
  if (!revId) html += feedbackHtml(key);

  const cats = Markup.parseCategories(rev.text);
  const catHtml = cats.length
    ? "Categories: " + cats.map(c => `<a href="#/category/${enc(c)}">${Markup.esc(Store.pretty(c))}</a>`).join(" | ")
    : "";

  show(Store.pretty(key), html, { categories: catHtml, footer: `Last edited ${fmt(rev.time)} by ${rev.author}` });
  if (!revId) bindFeedback(key);
}

/* ---------- Article feedback ---------- */
function feedbackHtml(key) {
  const mine = Store.myFeedback(key) || {};
  const s = Store.feedbackSummary(key);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star ${mine.clarity >= n ? "on" : ""}" data-clarity="${n}" aria-label="${n} out of 5">&#9733;</button>`).join("");
  const pct = s.helpfulTotal ? Math.round(100 * s.helpfulYes / s.helpfulTotal) : null;
  const summary = [
    pct !== null ? `${pct}% found this helpful (${s.helpfulTotal} ${s.helpfulTotal === 1 ? "vote" : "votes"})` : "No helpfulness votes yet",
    s.clarityAvg !== null ? `Clarity: ${s.clarityAvg.toFixed(1)}/5 (${s.clarityTotal} ${s.clarityTotal === 1 ? "rating" : "ratings"})` : "No clarity ratings yet"
  ].join(" &middot; ");
  const notes = s.notes.slice(0, 5).map(n => `<li>${Markup.esc(n.note)} <span class="meta">${fmt(n.time)}</span></li>`).join("");

  return `
  <section id="feedback" class="feedback">
    <h2>Article feedback</h2>
    <div class="fb-row"><span>Was this article helpful?</span>
      <button type="button" class="fb-btn ${mine.helpful === true ? "on" : ""}" data-helpful="1">Yes</button>
      <button type="button" class="fb-btn ${mine.helpful === false ? "on" : ""}" data-helpful="0">No</button></div>
    <div class="fb-row"><span>Was it easy to understand?</span><span class="stars">${stars}</span></div>
    <div class="fb-row"><input type="text" id="fb-note" maxlength="300" placeholder="Optional: what could be better?" value="${Markup.esc(mine.note || "")}">
      <button type="button" id="fb-send">Send</button></div>
    <p class="fb-summary" id="fb-summary">${summary}</p>
    <p class="fb-thanks" id="fb-thanks" hidden>Thanks for your feedback.</p>
    ${notes ? `<details><summary>Recent reader notes</summary><ul>${notes}</ul></details>` : ""}
  </section>`;
}

function bindFeedback(key) {
  const root = $("feedback");
  if (!root) return;
  const mine = Store.myFeedback(key) || {};
  let helpful = mine.helpful ?? null, clarity = mine.clarity ?? null;
  const send = () => {
    Store.submitFeedback(key, { helpful, clarity, note: $("fb-note").value });
    const fresh = document.createElement("div");
    fresh.innerHTML = feedbackHtml(key);
    $("fb-summary").innerHTML = fresh.querySelector("#fb-summary").innerHTML;
    $("fb-thanks").hidden = false;
  };
  root.querySelectorAll("[data-helpful]").forEach(b => b.onclick = () => {
    helpful = b.dataset.helpful === "1";
    root.querySelectorAll("[data-helpful]").forEach(x => x.classList.toggle("on", x === b));
    send();
  });
  root.querySelectorAll("[data-clarity]").forEach(b => b.onclick = () => {
    clarity = Number(b.dataset.clarity);
    root.querySelectorAll("[data-clarity]").forEach(x => x.classList.toggle("on", Number(x.dataset.clarity) <= clarity));
    send();
  });
  $("fb-send").onclick = send;
}

/* ---------- Edit ---------- */
function viewEdit(title) {
  const key = Store.normalize(title);
  currentTitle = key;
  const page = Store.getPage(key);
  setTabs(key, "edit");
  const text = page ? Store.currentText(page) : "";
  show((page ? "Editing " : "Creating ") + Store.pretty(key), `
    <div class="field"><label>Title <input type="text" id="edit-title" value="${Markup.esc(Store.pretty(key))}"></label></div>
    <textarea id="editor">${Markup.esc(text)}</textarea>
    <div class="field"><input type="text" id="edit-summary" placeholder="Edit summary (briefly describe your change)"></div>
    <div class="field"><input type="text" id="edit-author" placeholder="Your name (optional)" value="${Markup.esc(localStorage.getItem("wikimedia-author") || "")}"></div>
    <p><button class="primary" id="save-btn">Save page</button> <a class="btn" href="#/wiki/${enc(key)}">Cancel</a></p>
    <p style="font-size:.85rem;color:#54595d">Markup: <code>== Heading ==</code>, <code>[[Link]]</code>, <code>[[Link|label]]</code>, <code>'''bold'''</code>, <code>''italic''</code>, <code>* bullet</code>, <code>[[Category:Name]]</code>, <code>#REDIRECT [[Page]]</code></p>
  `);
  $("save-btn").onclick = () => {
    const newTitle = $("edit-title").value.trim();
    if (!newTitle) return alert("Please enter a title.");
    const author = $("edit-author").value.trim();
    if (author) localStorage.setItem("wikimedia-author", author);
    const saved = Store.savePage(newTitle, $("editor").value, $("edit-summary").value, author);
    location.hash = `#/wiki/${enc(saved)}`;
  };
}

/* ---------- History ---------- */
function viewHistory(title) {
  const key = Store.normalize(title);
  currentTitle = key;
  setTabs(key, "history");
  const page = Store.getPage(key);
  if (!page) return show("History: " + Store.pretty(key), "<p>No such page.</p>");
  const rows = page.revisions.slice().reverse().map((r, i) =>
    `<tr><td><a href="#/rev/${enc(key)}/${r.id}">${fmt(r.time)}</a>${i === 0 ? " (current)" : ""}</td><td>${Markup.esc(r.author)}</td><td>${Markup.esc(r.summary)}</td></tr>`).join("");
  show("History: " + Store.pretty(key), `<table class="list"><tr><th>Date</th><th>User</th><th>Summary</th></tr>${rows}</table>`);
}

/* ---------- Discussion (comments) ---------- */
function viewTalk(title) {
  const key = Store.normalize(title);
  currentTitle = key;
  setTabs(key, "talk");
  const all = Store.comments(key);

  const renderThread = (parent) => all.filter(c => c.parentId === parent).map(c => `
    <div class="comment">
      <div class="meta"><strong>${Markup.esc(c.author)}</strong> &middot; ${fmt(c.time)}</div>
      <div>${Markup.esc(c.text).replace(/\n/g, "<br>")}</div>
      <a href="javascript:void(0)" data-reply="${c.id}" style="font-size:.8rem">Reply</a>
      <div class="replies">${renderThread(c.id)}</div>
    </div>`).join("");

  show("Discussion: " + Store.pretty(key), `
    ${all.length ? renderThread(null) : "<p>No comments yet. Start the discussion.</p>"}
    <form class="comment-form" id="comment-form">
      <div class="field"><input type="text" id="c-author" placeholder="Your name" value="${Markup.esc(localStorage.getItem("wikimedia-author") || "")}"></div>
      <textarea id="c-text" placeholder="Write a comment..."></textarea>
      <input type="hidden" id="c-parent" value="">
      <p><button class="primary" type="submit">Post comment</button> <span id="reply-note"></span></p>
    </form>`);

  document.querySelectorAll("[data-reply]").forEach(a => a.onclick = () => {
    $("c-parent").value = a.dataset.reply;
    $("reply-note").textContent = "Replying to a comment";
    $("c-text").focus();
  });
  $("comment-form").onsubmit = (e) => {
    e.preventDefault();
    const text = $("c-text").value.trim();
    if (!text) return;
    const author = $("c-author").value.trim();
    if (author) localStorage.setItem("wikimedia-author", author);
    Store.addComment(key, text, author, $("c-parent").value ? Number($("c-parent").value) : null);
    viewTalk(key);
  };
}

/* ---------- Category / search / specials ---------- */
function viewCategory(name) {
  clearTabs();
  const key = Store.normalize(name);
  const members = Store.allPages().filter(p => Markup.parseCategories(Store.currentText(p)).includes(key));
  show("Category: " + Store.pretty(key),
    members.length ? `<ul>${members.map(p => `<li><a href="#/wiki/${enc(p.title)}">${Markup.esc(Store.pretty(p.title))}</a></li>`).join("")}</ul>` : "<p>No pages in this category.</p>");
}

function viewSearch(q) {
  clearTabs();
  const term = (q || "").trim().toLowerCase();
  if (!term) return show("Search", "<p>Enter a search term.</p>");
  const exact = Store.getPage(term);
  if (exact) { location.hash = `#/wiki/${enc(exact.title)}`; return; }
  const hits = Store.allPages().filter(p =>
    p.title.toLowerCase().includes(term.replace(/\s+/g, "_")) || Store.currentText(p).toLowerCase().includes(term));
  show(`Search results for "${q}"`, hits.length
    ? `<ul>${hits.map(p => `<li><a href="#/wiki/${enc(p.title)}">${Markup.esc(Store.pretty(p.title))}</a></li>`).join("")}</ul>`
    : `<p>No results. <a href="#/edit/${enc(Store.normalize(q))}">Create the page "${Markup.esc(q)}"</a>.</p>`);
}

function viewRecent() {
  clearTabs();
  const rows = Store.recentChanges().map(r =>
    `<tr><td>${fmt(r.time)}</td><td><a href="#/wiki/${enc(r.title)}">${Markup.esc(Store.pretty(r.title))}</a></td><td>${Markup.esc(r.author)}</td><td>${Markup.esc(r.summary)}</td></tr>`).join("");
  show("Recent changes", `<table class="list"><tr><th>When</th><th>Page</th><th>User</th><th>Summary</th></tr>${rows}</table>`);
}

function viewAll() {
  clearTabs();
  show("All pages", `<ul>${Store.allPages().map(p => `<li><a href="#/wiki/${enc(p.title)}">${Markup.esc(Store.pretty(p.title))}</a></li>`).join("")}</ul>`);
}

function viewRandom() {
  const pages = Store.allPages();
  const p = pages[Math.floor(Math.random() * pages.length)];
  location.hash = `#/wiki/${enc(p.title)}`;
}

function viewWhatLinksHere(title) {
  clearTabs();
  const key = Store.normalize(title);
  const hits = Store.allPages().filter(p => Markup.parseLinks(Store.currentText(p)).includes(key));
  show("What links here: " + Store.pretty(key),
    hits.length ? `<ul>${hits.map(p => `<li><a href="#/wiki/${enc(p.title)}">${Markup.esc(Store.pretty(p.title))}</a></li>`).join("")}</ul>` : "<p>No pages link here.</p>");
}

/* ---------- Router ---------- */
function route() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").map(dec);
  const [kind, a, b] = parts;

  switch (kind) {
    case "": case undefined: return viewArticle("Main_Page");
    case "wiki": return viewArticle(a || "Main_Page");
    case "edit": return viewEdit(a || "New_page");
    case "history": return viewHistory(a);
    case "rev": return viewArticle(a, b);
    case "talk": return viewTalk(a);
    case "category": return viewCategory(a);
    case "search": return viewSearch(new URLSearchParams(query || "").get("q"));
    case "whatlinkshere": return viewWhatLinksHere(a);
    case "special":
      if (a === "recent") return viewRecent();
      if (a === "all") return viewAll();
      if (a === "random") return viewRandom();
      break;
  }
  clearTabs();
  show("Page not found", "<p>Unknown address.</p>");
}

document.addEventListener("click", (e) => {
  const j = e.target.closest("[data-jump]");
  if (j) { const el = document.getElementById(j.dataset.jump); if (el) el.scrollIntoView({ behavior: "smooth" }); }
});

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  location.hash = `#/search?q=${enc($("search-input").value)}`;
});
$("whatlinkshere-link").addEventListener("click", (e) => {
  e.preventDefault();
  location.hash = `#/whatlinkshere/${enc(currentTitle)}`;
});

window.addEventListener("hashchange", route);
Store.seed();
route();