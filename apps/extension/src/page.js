// Dovli's helper inside a web page, set up when the popup opens (see inPage in api.js). It shows which
// part of the page a clip will take, lets the person make that part bigger or smaller, and runs the
// highlighter. Its own UI sits in a closed shadow root, so the page's styles can't reach it.
// Injected again on every use, so it sets itself up once per page.

(() => {
  if (globalThis.__dovli) return;

  const REGION = "data-dovli-region";
  const HL_STYLE = "background:rgba(255,212,59,.5);color:inherit;border-radius:2px;box-shadow:0 0 0 1px rgba(255,212,59,.5);";

  let host = null;
  let frame = null;
  let label = null;
  let bar = null;
  let region = null;
  let showing = "none";
  const grown = []; // what each "bigger" step came from, so "smaller" goes back the same way
  let chosen = false; // made bigger or smaller by the person, rather than Dovli's guess
  let raf = 0;

  /* ---------- The overlay ---------- */

  const STYLES = `
    :host { all: initial; }
    .frame { position: fixed; box-sizing: border-box; border: 2px solid #6a5cf0; border-radius: 8px; pointer-events: none;
      box-shadow: 0 0 0 100vmax rgba(14, 12, 22, 0.36); transition: top 180ms cubic-bezier(.22,1,.36,1), left 180ms cubic-bezier(.22,1,.36,1),
      width 180ms cubic-bezier(.22,1,.36,1), height 180ms cubic-bezier(.22,1,.36,1); }
    .frame.whole { box-shadow: none; border-radius: 10px; }
    .label { position: absolute; top: -2px; left: -2px; transform: translateY(-100%); padding: 3px 8px; border-radius: 6px 6px 0 0;
      background: #6a5cf0; color: #fff; font: 600 12px/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; white-space: nowrap; }
    .frame.low .label { top: auto; bottom: -2px; transform: translateY(100%); border-radius: 0 0 6px 6px; }
    .frame.whole .label { top: 6px; left: 6px; transform: none; border-radius: 6px; }
    .bar { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px;
      padding: 8px 8px 8px 14px; border-radius: 12px; background: #16131f; color: #f1eff7; pointer-events: auto;
      box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 16px 40px rgba(0,0,0,.35); font: 13.5px/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      animation: up 220ms cubic-bezier(.22,1,.36,1); }
    .swatch { width: 14px; height: 14px; border-radius: 4px; background: rgb(255,212,59); flex: none; }
    .count { color: #aca6bf; }
    button { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 8px; background: #b3a6ff; color: #120f1e; font-weight: 600; }
    button:hover { background: #c4baff; }
    button:focus-visible { outline: 2px solid #b3a6ff; outline-offset: 2px; }
    [hidden] { display: none !important; }
    @keyframes up { from { opacity: 0; transform: translate(-50%, 8px); } }
    @media (prefers-reduced-motion: reduce) { .frame, .bar { transition: none; animation: none; } }
  `;

  function ui() {
    if (host?.isConnected) return;
    host = document.createElement("dovli-clipper");
    host.id = "dovli-clipper";
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLES;
    frame = Object.assign(document.createElement("div"), { className: "frame", hidden: true });
    label = Object.assign(document.createElement("span"), { className: "label" });
    frame.append(label);
    bar = Object.assign(document.createElement("div"), { className: "bar", hidden: true });
    bar.setAttribute("role", "status");
    const text = Object.assign(document.createElement("span"), { textContent: "Select text to highlight it. Click a highlight to remove it." });
    const count = Object.assign(document.createElement("span"), { className: "count" });
    const done = Object.assign(document.createElement("button"), { type: "button", textContent: "Done" });
    done.addEventListener("click", () => highlighter(false));
    bar.append(Object.assign(document.createElement("span"), { className: "swatch" }), text, count, done);
    root.append(style, frame, bar);
    document.documentElement.append(host);
  }

  const words = (el) => (el?.innerText ?? el?.textContent ?? "").trim().split(/\s+/).filter(Boolean).length;
  const shown = (el) => el.getClientRects().length > 0;

  function place() {
    raf = 0;
    if (showing === "none" || !frame) return;
    if (showing === "page") {
      Object.assign(frame.style, { top: "4px", left: "4px", width: "calc(100vw - 8px)", height: "calc(100vh - 8px)" });
      return;
    }
    if (!region?.isConnected) return;
    const r = region.getBoundingClientRect();
    const pad = 6;
    Object.assign(frame.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    // Keep the label on screen when the part starts above the window.
    frame.classList.toggle("low", r.top < 36);
  }
  const later = () => (raf ||= requestAnimationFrame(place));

  /* ---------- Finding the article ---------- */

  // Like a reader view: the element holding the most paragraph text, or the page's own <article> or
  // <main> around it when that's not much bigger (it usually adds the title).
  function guess() {
    const score = new Map();
    for (const p of document.querySelectorAll("p, pre, blockquote, li")) {
      const n = p.textContent.trim().length;
      if (n < 40 || !shown(p)) continue;
      const up = p.parentElement;
      if (!up) continue;
      score.set(up, (score.get(up) ?? 0) + n);
      if (up.parentElement) score.set(up.parentElement, (score.get(up.parentElement) ?? 0) + n / 2);
    }
    let best = null;
    let top = 0;
    for (const [el, s] of score) if (s > top && el !== document.body && el !== document.documentElement) [best, top] = [el, s];
    if (!best) return document.querySelector("article, main, [role=main]") ?? document.body;
    const marked = best.closest('article, [itemprop="articleBody"], main, [role="main"]');
    if (marked && marked !== best && words(marked) < words(best) * 2.5) best = marked;
    return best;
  }

  function mark(el) {
    region?.removeAttribute(REGION);
    region = el;
    region.setAttribute(REGION, chosen ? "chosen" : "guess");
  }

  // Wrappers that hold exactly the same text would look like nothing happened, so they're skipped.
  function biggestChild(el) {
    const own = words(el);
    let pick = null;
    let most = 0;
    for (const c of el.children) {
      if (!shown(c)) continue;
      const n = words(c);
      if (n > most) [pick, most] = [c, n];
    }
    if (!pick || most < 8) return null;
    return most === own ? biggestChild(pick) ?? pick : pick;
  }
  function parentOf(el) {
    let up = el.parentElement;
    while (up && up !== document.body && words(up) === words(el)) up = up.parentElement;
    return up && up !== document.documentElement ? up : null;
  }

  function info() {
    if (showing !== "region" || !region) return null;
    return { words: words(region), canGrow: !!parentOf(region) && region !== document.body, canShrink: grown.length > 0 || !!biggestChild(region) };
  }

  function preview(kind) {
    ui();
    showing = kind === "region" || kind === "page" ? kind : "none";
    frame.hidden = showing === "none";
    frame.classList.toggle("whole", showing === "page");
    if (showing === "none") return null;
    if (showing === "page") {
      label.textContent = "The whole page";
      place();
      return null;
    }
    if (!region?.isConnected) {
      grown.length = 0;
      chosen = false;
      mark(guess());
    }
    label.textContent = `${words(region).toLocaleString()} words`;
    place();
    // Only when the part is out of sight altogether: otherwise the page stays where the person left it.
    const r = region.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) region.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    return info();
  }

  function resize(step) {
    if (showing !== "region" || !region) return info();
    chosen = true;
    if (step > 0) {
      const up = parentOf(region);
      if (up) {
        grown.push(region);
        mark(up);
      }
    } else {
      const down = grown.pop() ?? biggestChild(region);
      if (down) mark(down);
    }
    return preview("region");
  }

  function clear() {
    showing = "none";
    if (frame) frame.hidden = true;
    region?.removeAttribute(REGION);
    region = null;
    grown.length = 0;
    chosen = false;
    return null;
  }

  addEventListener("scroll", later, { capture: true, passive: true });
  addEventListener("resize", later, { passive: true });

  /* ---------- The highlighter ---------- */

  let highlighting = false;
  let made = 0;
  // One highlight can take several <mark>s (one per text node); they share an id and count as one.
  const highlights = () => new Set([...document.querySelectorAll("mark[data-dovli]")].map((m) => m.getAttribute("data-dovli"))).size;

  function showCount() {
    if (!bar) return;
    const n = highlights();
    bar.querySelector(".count").textContent = n ? `${n} highlighted` : "";
  }

  /** Wrap the text in a range in highlights, one per text node, so it works across links and paragraphs. */
  function highlightRange(range) {
    const { startContainer, startOffset, endContainer, endOffset } = range;
    const within = (n) => range.intersectsNode(n) && n.textContent.trim() && !n.parentElement?.closest("script, style, textarea, input, select, mark[data-dovli], dovli-clipper");
    const nodes = [];
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
      if (within(root)) nodes.push(root);
    } else {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (within(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      while (walk.nextNode()) nodes.push(walk.currentNode);
    }
    const id = `${Date.now().toString(36)}-${++made}`;
    for (let n of nodes) {
      // The end first, so the start offset still counts from the same place.
      if (n === endContainer && endOffset < n.length) n.splitText(endOffset);
      if (n === startContainer && startOffset > 0) n = n.splitText(startOffset);
      if (!n.textContent.trim()) continue;
      const m = document.createElement("mark");
      m.setAttribute("data-dovli", id);
      m.style.cssText = HL_STYLE;
      n.replaceWith(m);
      m.append(n);
    }
    return nodes.length;
  }

  // A drag that stops inside a word means that word: "b|erries" highlights "berries".
  function wholeWords(range) {
    const letter = /[\p{L}\p{N}'’_-]/u;
    const { startContainer: start, endContainer: end } = range;
    if (start.nodeType === Node.TEXT_NODE) {
      let i = range.startOffset;
      while (i > 0 && letter.test(start.data[i - 1])) i--;
      range.setStart(start, i);
    }
    if (end.nodeType === Node.TEXT_NODE) {
      let i = range.endOffset;
      while (i < end.data.length && letter.test(end.data[i])) i++;
      range.setEnd(end, i);
    }
    return range;
  }

  function highlightSelection() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return highlights();
    for (let i = 0; i < sel.rangeCount; i++) highlightRange(wholeWords(sel.getRangeAt(i).cloneRange()));
    sel.removeAllRanges();
    showCount();
    return highlights();
  }

  function unwrap(m) {
    const parent = m.parentNode;
    m.replaceWith(...m.childNodes);
    parent?.normalize();
  }

  const fromUs = (e) => host && e.composedPath().includes(host);
  const onUp = (e) => {
    if (!fromUs(e)) setTimeout(highlightSelection, 0);
  };
  const onClick = (e) => {
    const m = e.target instanceof Element ? e.target.closest("mark[data-dovli]") : null;
    if (!m || !getSelection()?.isCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll(`mark[data-dovli="${CSS.escape(m.getAttribute("data-dovli"))}"]`).forEach(unwrap);
    showCount();
  };
  const onKey = (e) => {
    if (e.key === "Escape") highlighter(false);
  };

  function highlighter(on) {
    ui();
    highlighting = !!on;
    bar.hidden = !highlighting;
    const method = highlighting ? "addEventListener" : "removeEventListener";
    document[method]("mouseup", onUp, true);
    document[method]("click", onClick, true);
    document[method]("keydown", onKey, true);
    if (highlighting) {
      // Whatever is selected already is what they wanted highlighted.
      highlightSelection();
      bar.querySelector("button").focus({ preventScroll: true });
    }
    showCount();
    return highlights();
  }

  function clearHighlights() {
    document.querySelectorAll("mark[data-dovli]").forEach(unwrap);
    showCount();
    return 0;
  }

  globalThis.__dovli = { preview, grow: () => resize(1), shrink: () => resize(-1), clear, highlighter, highlightSelection, highlights, clearHighlights };
})();
