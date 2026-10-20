// Small UI pieces shared by the popup and the drawer. Built with DOM nodes, never HTML strings.

const SVG = "http://www.w3.org/2000/svg";

/** One of Dovli's icons from icons.svg. */
export function icon(name, className = "") {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", `i ${className}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG, "use");
  use.setAttribute("href", `icons.svg#${name}`);
  svg.append(use);
  return svg;
}

const TONE_ICON = { ok: "check", error: "alert" };

/**
 * Show a message in `box`: tone "busy" (with a spinner), "ok", "error" or "" (plain). An optional
 * action adds a button. "ok" messages go away on their own. Returns a function that hides it.
 */
export function toast(box, text, tone = "", action = null) {
  clearTimeout(box._timer);
  const card = document.createElement("div");
  card.className = `toast ${tone}`;
  card.setAttribute("role", tone === "error" ? "alert" : "status");
  if (tone === "busy") card.append(Object.assign(document.createElement("span"), { className: "spinner" }));
  else if (TONE_ICON[tone]) card.append(icon(TONE_ICON[tone]));
  card.append(Object.assign(document.createElement("span"), { className: "toast-text", textContent: text }));
  if (action) {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "link", textContent: action.label });
    b.addEventListener("click", action.run);
    card.append(b);
  }
  box.replaceChildren(card);
  box.hidden = false;
  const hide = () => {
    box.hidden = true;
    box.replaceChildren();
  };
  if (tone === "ok") box._timer = setTimeout(hide, action ? 8000 : 4000);
  return hide;
}
