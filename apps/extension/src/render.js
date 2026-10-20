// Drawing a Dovli page in the side panel. Pages arrive as their stored blocks (see pageView on the
// server), and everything is built with DOM nodes and text, never from HTML strings, so nothing a
// page contains can run here. `doc` is passed in so this can be tested outside a browser.

const SAFE_LINK = /^(https?:|mailto:)/i;
const WEB = /^https?:/i;

/** Block types the panel can edit as Markdown. The rest (sub-pages, flowcharts, files…) open in Dovli. */
export const EDITABLE = new Set(["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem", "quote", "codeBlock", "callout", "caption", "table", "image", "divider", "embed"]);

const el = (doc, tag, cls, text) => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

function styled(doc, text, styles = {}) {
  let node = doc.createTextNode(text);
  const wrap = (tag) => {
    const w = doc.createElement(tag);
    w.append(node);
    node = w;
  };
  if (styles.code) wrap("code");
  if (styles.bold) wrap("strong");
  if (styles.italic) wrap("em");
  if (styles.underline) wrap("u");
  if (styles.strike) wrap("s");
  if (styles.backgroundColor && styles.backgroundColor !== "default") wrap("mark");
  return node;
}

/** Inline text (runs of styled text, links, links to pages) as nodes. */
export function inline(content, doc, { appUrl } = {}) {
  const out = doc.createDocumentFragment();
  if (typeof content === "string") {
    out.append(doc.createTextNode(content));
    return out;
  }
  for (const c of Array.isArray(content) ? content : []) {
    if (!c) continue;
    if (c.type === "text") out.append(styled(doc, c.text ?? "", c.styles));
    else if (c.type === "link") {
      const inner = inline(c.content, doc);
      if (SAFE_LINK.test(c.href ?? "")) {
        const a = el(doc, "a");
        a.href = c.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.append(inner);
        out.append(a);
      } else out.append(inner);
    } else if (c.type === "pageLink") {
      const a = el(doc, "a", "page-link", c.props?.title || "Untitled");
      if (appUrl && c.props?.pageId) {
        a.href = appUrl(c.props.pageId);
        a.target = "_blank";
        a.rel = "noopener";
      }
      out.append(a);
    }
  }
  return out;
}

const cellContent = (cell) => (Array.isArray(cell) || typeof cell === "string" ? cell : (cell?.content ?? []));

function chip(doc, text, href) {
  const a = el(doc, href ? "a" : "span", "chip", text);
  if (href) {
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
  }
  return a;
}

/** One block's content (not its marker or indent). */
function body(b, doc, opts) {
  const p = b.props ?? {};
  switch (b.type) {
    case "heading": {
      const h = el(doc, `h${Math.min(3, Math.max(1, p.level ?? 1))}`);
      h.append(inline(b.content, doc, opts));
      return h;
    }
    case "quote": {
      const q = el(doc, "blockquote");
      q.append(inline(b.content, doc, opts));
      return q;
    }
    case "codeBlock": {
      const pre = el(doc, "pre");
      const code = el(doc, "code", null, typeof b.content === "string" ? b.content : "");
      if (p.language && p.language !== "text") pre.dataset.lang = p.language;
      pre.append(code);
      return pre;
    }
    case "divider":
      return el(doc, "hr");
    case "table": {
      const table = el(doc, "table");
      (b.content?.rows ?? []).forEach((row, i) => {
        const tr = el(doc, "tr");
        for (const cell of row.cells ?? []) {
          const td = el(doc, i === 0 ? "th" : "td");
          td.append(inline(cellContent(cell), doc, opts));
          tr.append(td);
        }
        table.append(tr);
      });
      const wrap = el(doc, "div", "table-wrap");
      wrap.append(table);
      return wrap;
    }
    case "image": {
      // Pictures kept in Dovli's own storage only open in the app.
      if (!WEB.test(p.url ?? "")) return chip(doc, "🖼 Picture — open in Dovli to see it", opts.pageHref);
      const fig = el(doc, "figure");
      const img = el(doc, "img");
      img.src = p.url;
      img.alt = p.caption || "";
      img.setAttribute("loading", "lazy");
      img.setAttribute("referrerpolicy", "no-referrer");
      fig.append(img);
      if (p.caption) fig.append(el(doc, "figcaption", null, p.caption));
      return fig;
    }
    case "callout": {
      const box = el(doc, "div", `callout tone-${["note", "tip", "warning", "danger"].includes(p.tone) ? p.tone : "note"}`);
      if (p.emoji) box.append(el(doc, "span", "emoji", p.emoji));
      const text = el(doc, "div");
      text.append(inline(b.content, doc, opts));
      box.append(text);
      return box;
    }
    case "caption": {
      const s = el(doc, "small");
      s.append(inline(b.content, doc, opts));
      return s;
    }
    case "embed": {
      const link = SAFE_LINK.test(p.link ?? "") ? p.link : "";
      const card = el(doc, link ? "a" : "div", "card");
      if (link) {
        card.href = link;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      }
      card.append(el(doc, "strong", null, p.title || link || "Link"), el(doc, "small", null, p.siteName || ""));
      return card;
    }
    case "subpage":
      return chip(doc, "📄 A page inside this one — open in Dovli", opts.appUrl && p.pageId ? opts.appUrl(p.pageId) : opts.pageHref);
    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "checkListItem":
    case "toggleListItem": {
      const t = el(doc, "div", "text");
      t.append(inline(b.content, doc, opts));
      return t;
    }
    default:
      return chip(doc, `${b.type === "flowchart" ? "◇ Flowchart" : b.type === "whiteboard" ? "◇ Sketch" : "▣ " + b.type} — open in Dovli to see it`, opts.pageHref);
  }
}

/**
 * The page's blocks as nodes. Each block is a .block with data-id, data-type, data-editable and
 * an indent (--depth). Checkboxes carry data-action="toggle".
 */
export function renderBlocks(blocks, doc, opts = {}) {
  const out = doc.createDocumentFragment();
  // Numbered lists count per indent level, starting again after anything else at that level.
  const counters = [];
  for (const b of blocks ?? []) {
    counters.length = b.depth + 1;
    if (b.type === "numberedListItem") counters[b.depth] = (counters[b.depth] ?? 0) + 1;
    else counters[b.depth] = 0;

    const row = el(doc, "div", `block t-${b.type}`);
    row.dataset.id = b.id;
    row.dataset.type = b.type;
    row.dataset.editable = EDITABLE.has(b.type) ? "true" : "false";
    row.style.setProperty("--depth", String(b.depth));

    if (b.type === "bulletListItem") row.append(el(doc, "span", "marker", "•"));
    else if (b.type === "numberedListItem") row.append(el(doc, "span", "marker", `${counters[b.depth]}.`));
    else if (b.type === "toggleListItem") row.append(el(doc, "span", "marker", "▸"));
    else if (b.type === "checkListItem") {
      const box = el(doc, "input", "marker check");
      box.type = "checkbox";
      box.checked = !!b.props?.checked;
      box.dataset.action = "toggle";
      box.setAttribute("aria-label", b.props?.checked ? "Mark as not done" : "Mark as done");
      row.append(box);
      if (b.props?.checked) row.classList.add("done");
    }
    row.append(body(b, doc, opts));
    out.append(row);
  }
  return out;
}
