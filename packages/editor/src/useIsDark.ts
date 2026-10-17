import { useEffect, useState } from "react";

/** Dark when the host sets data-theme="dark", or when it sets nothing and the system prefers dark. */
function computeDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
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
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq?.removeEventListener?.("change", update);
      obs.disconnect();
    };
  }, []);
  return dark;
}
