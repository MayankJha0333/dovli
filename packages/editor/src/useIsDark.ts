import { createContext, useContext, useEffect, useState } from "react";

/**
 * Dark when the app's theme is dark (<html data-scheme="dark">), or when no theme is set and the
 * device prefers dark. Pages with a dark page style pass their own value instead.
 */
function computeDark(): boolean {
  const attr = document.documentElement.getAttribute("data-scheme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function useIsDark(): boolean {
  const [dark, setDark] = useState(computeDark);
  useEffect(() => {
    const update = () => setDark(computeDark());
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme"] });
    return () => {
      mq?.removeEventListener?.("change", update);
      obs.disconnect();
    };
  }, []);
  return dark;
}

/** Whether the open page's paper is dark. Set by PageEditor; null outside a page. */
export const PageDarkContext = createContext<boolean | null>(null);

/** Dark for drawings inside a page: follows a styled page's paper, else the app theme. */
export function usePageDark(): boolean {
  const app = useIsDark();
  return useContext(PageDarkContext) ?? app;
}
