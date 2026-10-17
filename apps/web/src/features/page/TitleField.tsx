import { useEffect, useRef } from "react";
import { store } from "@/lib/store";
import type { Page } from "@dovli/core";

export function TitleField({ page, onEnter }: { page: Page; onEnter: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(resize, [page.title, page.id]);
  useEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return (
    <textarea
      id="page-title"
      ref={ref}
      className="page-title"
      rows={1}
      value={page.title}
      placeholder={page.kind === "board" ? "Untitled board" : "Untitled"}
      aria-label="Page title"
      onChange={(e) => store.updatePage(page.id, { title: e.target.value.replace(/\n/g, "") })}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}
