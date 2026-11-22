const Store = (() => {
  const KEY = "wikimedia-data-v1";

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { pages: {}, comments: {}, nextId: 1 }; }
    catch (e) { return { pages: {}, comments: {}, nextId: 1 }; }
  };
  const save = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert("Could not save: storage full or blocked."); } };

  const normalize = (t) => {
    t = (t || "").trim().replace(/\s+/g, "_");
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const pretty = (t) => t.replace(/_/g, " ");

  const getPage = (title) => load().pages[normalize(title)] || null;
  const currentText = (page) => page.revisions[page.revisions.length - 1].text;

  const savePage = (title, text, summary, author) => {
    const db = load();
    const key = normalize(title);
    if (!db.pages[key]) db.pages[key] = { title: key, createdAt: Date.now(), revisions: [] };
    db.pages[key].revisions.push({
      id: db.nextId++, text, summary: summary || "", author: author || "Anonymous", time: Date.now()
    });
    save(db);
    return key;
  };

  const allPages = () => Object.values(load().pages).sort((a, b) => a.title.localeCompare(b.title));

  const recentChanges = () => {
    const out = [];
    allPages().forEach(p => p.revisions.forEach(r => out.push({ title: p.title, ...r })));
    return out.sort((a, b) => b.time - a.time).slice(0, 100);
  };

  const comments = (title) => (load().comments[normalize(title)] || []);
  const addComment = (title, text, author, parentId) => {
    const db = load();
    const key = normalize(title);
    (db.comments[key] = db.comments[key] || []).push({
      id: db.nextId++, parentId: parentId || null, author: author || "Anonymous", text, time: Date.now()
    });
    save(db);
  };

  /* ---- Article feedback: one entry per reader (browser) per article, changeable ---- */
  const voterId = () => {
    try {
      let v = localStorage.getItem("wikimedia-voter");
      if (!v) { v = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("wikimedia-voter", v); }
      return v;
    } catch (e) { return "anon"; }
  };

  const submitFeedback = (title, { helpful, clarity, note }) => {
    const db = load();
    const key = normalize(title);
    db.feedback = db.feedback || {};
    const list = (db.feedback[key] = db.feedback[key] || []);
    const me = voterId();
    const entry = list.find(f => f.voter === me);
    const data = { helpful: helpful ?? null, clarity: clarity ?? null, note: (note || "").trim(), time: Date.now() };
    if (entry) Object.assign(entry, data); else list.push({ voter: me, ...data });
    save(db);
  };

  const myFeedback = (title) => {
    const list = (load().feedback || {})[normalize(title)] || [];
    return list.find(f => f.voter === voterId()) || null;
  };

  const feedbackSummary = (title) => {
    const list = (load().feedback || {})[normalize(title)] || [];
    const helpfulVotes = list.filter(f => f.helpful !== null);
    const clarityVotes = list.filter(f => f.clarity !== null);
    return {
      helpfulYes: helpfulVotes.filter(f => f.helpful).length,
      helpfulTotal: helpfulVotes.length,
      clarityAvg: clarityVotes.length ? clarityVotes.reduce((s, f) => s + f.clarity, 0) / clarityVotes.length : null,
      clarityTotal: clarityVotes.length,
      notes: list.filter(f => f.note).sort((a, b) => b.time - a.time).map(f => ({ note: f.note, time: f.time }))
    };
  };

  const seed = () => {
    if (allPages().length) return;
    savePage("Main_Page",
`== Welcome to Wikimedia ==
This is the Wikimedia site. Click '''Edit''' to change this page, or create a new page with [[My first article]].

== Things to try ==
* Write articles using headings, [[links]] and categories
* Open the '''Discussion''' tab to leave comments
* Look at '''History''' to see every revision

[[Category:Help]]`, "Initial page", "System");
  };

  return { normalize, pretty, getPage, currentText, savePage, allPages, recentChanges, comments, addComment, submitFeedback, myFeedback, feedbackSummary, seed };
})();