// Which side of the sidebar is showing, like Craft: opening a page from Home, search, a tab or a
// link switches the sidebar to that page's contents; opening it from the sidebar's own page list
// keeps the list in view. A page that was only just made (new, duplicated, imported) keeps the
// sidebar as it was. Anything that isn't a page shows the workspace.

import { store } from "@/lib/store";
import { takeKeepSpace, ui } from "@/lib/ui";

let started = false;
export function startSidebarFollow() {
  if (started) return;
  started = true;
  const apply = () => {
    const r = store.get().route;
    const keep = takeKeepSpace();
    const page = r.name === "page" ? store.get().pages[r.id] : undefined;
    if (page && !keep && Date.now() - page.createdAt < 3000) return;
    const mode = r.name === "page" && !keep ? "page" : "space";
    if (ui.get().sidebarMode !== mode) ui.set({ sidebarMode: mode });
  };
  apply();
  let last = store.get().route;
  store.subscribe(() => {
    const r = store.get().route;
    if (r === last) return;
    last = r;
    apply();
  });
}
