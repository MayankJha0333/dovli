import "@/lib/editorBridge";
import { useEffect, useState } from "react";
import { store, useStore } from "@/lib/store";
import { displayTitle, type Page } from "@dovli/core";
import { Toasts } from "@/components/Toasts";
import { Home } from "@/features/home/Home";
import { PageView } from "@/features/page/PageView";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TemplatesView } from "@/features/templates/TemplatesView";

export default function Workspace() {
  const route = useStore((s) => s.route);
  const [navOpen, setNavOpen] = useState(false);
  const open = () => setNavOpen(true);
  const close = () => setNavOpen(false);

  useEffect(() => setNavOpen(false), [route]);
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace(/^#/, "");
      const pages = store.get().pages;
      if (h === "templates") store.navigate({ name: "templates" });
      else if (h.startsWith("p-") && pages[h.slice(2)]) store.navigate({ name: "page", id: h.slice(2) });
      else if (h === "home" || h === "") store.navigate({ name: "home" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const title =
      route.name === "page"
        ? displayTitle(store.get().pages[route.id] ?? ({ title: "", kind: "doc" } as Page))
        : route.name === "templates"
          ? "Templates"
          : "Home";
    document.title = `${title} · Dovli`;
  }, [route]);

  return (
    <div className="app">
      <Sidebar open={navOpen} onClose={close} />
      <div className={`scrim${navOpen ? " is-open" : ""}`} onClick={close} aria-hidden="true" />
      <main className="main">
        <div className="panel">
          {route.name === "home" && <Home onMenu={open} />}
          {route.name === "templates" && <TemplatesView onMenu={open} />}
          {route.name === "page" && <PageView key={route.id} id={route.id} onMenu={open} />}
        </div>
      </main>
      <Toasts />
    </div>
  );
}
