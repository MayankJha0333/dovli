// These run inside the web page (chrome.scripting.executeScript sends each function's source on its
// own), so each one must stand alone: no imports, nothing from outside the function.

/**
 * The page as the browser shows it right now: what a sign-in or a script put there is included,
 * while scripts, styles and parts that aren't showing (closed menus, pop-ups) are left out, and
 * lazy-loaded pictures get their real addresses. Dovli's server finds the article in it.
 * With scope "region", only the part outlined in the popup (marked by src/page.js) is kept in the
 * body; the head stays, for the title and what the page says about itself. `region` says whose
 * part it is: "guess" (Dovli's guess at the article) or "chosen" (the person made it bigger or smaller).
 */
export function capturePage(scope = "page") {
  const MAX = 3_000_000;
  const live = document.documentElement;
  const copy = live.cloneNode(true);

  // Both lists are in the same order, since the copy hasn't changed yet.
  const liveAll = live.querySelectorAll("body *");
  const copyAll = copy.querySelectorAll("body *");
  const hidden = [];
  if (liveAll.length === copyAll.length && liveAll.length < 60_000) {
    for (let i = 0; i < liveAll.length; i++) {
      const el = liveAll[i];
      if (el.tagName === "IMG" && el.currentSrc) copyAll[i].setAttribute("src", el.currentSrc);
      // Not shown on screen: menus, cookie banners, closed dialogs. (Closed <details> are kept: they're content.)
      if (!el.closest("details") && getComputedStyle(el).display === "none") hidden.push(copyAll[i]);
    }
  }
  for (const el of hidden) el.remove();
  copy.querySelectorAll('script:not([type="application/ld+json"]), style, noscript, template, svg, canvas, link, object, embed, #dovli-clipper').forEach((n) => n.remove());

  const part = scope === "region" ? copy.querySelector("[data-dovli-region]") : null;
  const region = part ? (part.getAttribute("data-dovli-region") === "chosen" ? "chosen" : "guess") : false;
  if (part) copy.querySelector("body")?.replaceChildren(part);
  copy.querySelectorAll("[data-dovli-region]").forEach((el) => el.removeAttribute("data-dovli-region"));
  // Highlights made with Dovli's highlighter stay as <mark>, which Dovli saves as highlighted text.
  copy.querySelectorAll("mark[data-dovli]").forEach((m) => {
    m.removeAttribute("data-dovli");
    m.removeAttribute("style");
  });

  let html = `<!doctype html>${copy.outerHTML}`;
  if (html.length > MAX) html = html.slice(0, MAX);
  return { html, url: location.href, title: document.title, region };
}

/** The page's address and title, its site's name, and its own summary of itself (for bookmarks). */
export function pageDetails() {
  const meta = (...names) => {
    for (const n of names) {
      const v = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute("content")?.trim();
      if (v) return v;
    }
    return "";
  };
  return {
    url: location.href,
    title: document.title,
    siteName: meta("og:site_name", "application-name").slice(0, 120),
    description: meta("og:description", "description", "twitter:description").slice(0, 1000),
  };
}

/** The selected part of the page, as HTML (keeping links, lists and code) and as plain text. */
export function captureSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return null;
  const box = document.createElement("div");
  for (let i = 0; i < sel.rangeCount; i++) box.append(sel.getRangeAt(i).cloneContents());
  box.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
  // Selected items of a list arrive without their list, so give them one back.
  if (box.firstElementChild?.tagName === "LI") {
    const anchor = sel.getRangeAt(0).commonAncestorContainer;
    const list = document.createElement(anchor.nodeType === 1 && anchor.tagName === "OL" ? "ol" : "ul");
    list.append(...box.childNodes);
    box.append(list);
  }
  for (const img of box.querySelectorAll("img")) if (img.currentSrc) img.setAttribute("src", img.currentSrc);
  return { html: box.innerHTML.slice(0, 2_000_000), text: sel.toString().slice(0, 200_000), url: location.href, title: document.title };
}
