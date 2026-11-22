const Markup = (() => {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const parseCategories = (text) => {
    const cats = [];
    text.replace(/\[\[Category:([^\]|]+)\]\]/gi, (_, c) => { cats.push(Store.normalize(c)); return ""; });
    return cats;
  };

  const parseLinks = (text) => {
    const out = [];
    text.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, t) => {
      if (!/^category:/i.test(t)) out.push(Store.normalize(t));
      return "";
    });
    return out;
  };

  const redirectTarget = (text) => {
    const m = text.match(/^\s*#REDIRECT\s*\[\[([^\]]+)\]\]/i);
    return m ? Store.normalize(m[1]) : null;
  };

  const inline = (s) => {
    s = esc(s);
    s = s.replace(/\[\[Category:[^\]]*\]\]/gi, "");
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const key = Store.normalize(target);
      const exists = !!Store.getPage(key);
      const href = exists ? `#/wiki/${encodeURIComponent(key)}` : `#/edit/${encodeURIComponent(key)}`;
      return `<a href="${href}" class="${exists ? "" : "redlink"}">${label || target}</a>`;
    });
    s = s.replace(/'''(.+?)'''/g, "<strong>$1</strong>").replace(/''(.+?)''/g, "<em>$1</em>");
    return s;
  };

  const render = (text) => {
    const lines = text.split("\n");
    const html = [];
    const headings = [];
    let list = null;
    let para = [];

    const closePara = () => { if (para.length) { html.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };

    lines.forEach(line => {
      let m;
      if ((m = line.match(/^(={2,4})\s*(.+?)\s*\1\s*$/))) {
        closePara(); closeList();
        const level = m[1].length;
        const id = "sec-" + headings.length;
        headings.push({ level, text: m[2], id });
        html.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      } else if ((m = line.match(/^([*#])\s+(.*)$/))) {
        closePara();
        const type = m[1] === "*" ? "ul" : "ol";
        if (list !== type) { closeList(); html.push(`<${type}>`); list = type; }
        html.push(`<li>${inline(m[2])}</li>`);
      } else if (line.trim() === "") {
        closePara(); closeList();
      } else {
        closeList();
        para.push(line);
      }
    });
    closePara(); closeList();

    let toc = "";
    if (headings.length >= 3) {
      toc = `<div class="toc"><strong>Contents</strong><ol>` +
        headings.map(h => `<li style="margin-left:${(h.level - 2) * 1}rem"><a href="javascript:void(0)" data-jump="${h.id}">${inline(h.text)}</a></li>`).join("") +
        `</ol></div>`;
    }
    return toc + html.join("\n");
  };

  return { render, parseCategories, parseLinks, redirectTarget, esc };
})();