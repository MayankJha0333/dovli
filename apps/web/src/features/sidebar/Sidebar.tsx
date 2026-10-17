import { useEffect, useMemo, useRef, useState } from "react";
import { store, useStore } from "@/lib/store";
import { childrenOf, displayTitle, pageText, type Page } from "@dovli/core";
import { Icon } from "@/components/Icon";
import { newPage } from "@/features/pages/actions";

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function TreeRow({ page, depth, onPick }: { page: Page; depth: number; onPick: () => void }) {
  const pages = useStore((s) => s.pages);
  const route = useStore((s) => s.route);
  const kids = childrenOf(pages, page.id);
  const active = route.name === "page" && route.id === page.id;
  return (
    <li>
      <div className={`tree-row${active ? " is-active" : ""}`} style={{ paddingLeft: `${4 + depth * 14}px` }}>
        <button
          type="button"
          className="tree-row__chev"
          aria-label={page.expanded ? "Collapse" : "Expand"}
          aria-expanded={kids.length ? !!page.expanded : undefined}
          disabled={!kids.length}
          onClick={() => store.updatePage(page.id, { expanded: !page.expanded }, false)}
        >
          {kids.length ? (
            <span className={`chev${page.expanded ? " is-open" : ""}`}>
              <Icon name="chevron" size={12} />
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="tree-row__link"
          aria-current={active ? "page" : undefined}
          onClick={() => {
            store.navigate({ name: "page", id: page.id });
            onPick();
          }}
        >
          <span className="tree-row__mark">{page.mark}</span>
          <span className="tree-row__title">{displayTitle(page)}</span>
        </button>
        <button
          type="button"
          className="tree-row__add"
          aria-label={`Add a page inside ${displayTitle(page)}`}
          title="Add a page inside"
          onClick={() => {
            newPage("doc", page.id);
            onPick();
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      {kids.length > 0 && page.expanded && (
        <ul className="tree">
          {kids.map((k) => (
            <TreeRow key={k.id} page={k} depth={depth + 1} onPick={onPick} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pages = useStore((s) => s.pages);
  const route = useStore((s) => s.route);
  const status = useStore((s) => s.saveStatus);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const roots = childrenOf(pages, null);

  // ⌘K / Ctrl+K jumps to search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return Object.values(pages)
      .filter((p) => displayTitle(p).toLowerCase().includes(term) || pageText(p).toLowerCase().includes(term))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
  }, [q, pages]);

  const go = (r: Parameters<typeof store.navigate>[0]) => {
    store.navigate(r);
    onClose();
  };

  return (
    <aside className={`sidebar${open ? " is-open" : ""}`} aria-label="Pages">
      <div className="sidebar__top">
        <button type="button" className="brand" onClick={() => go({ name: "home" })}>
          <span className="brand__tile" aria-hidden="true">D</span>
          <span className="brand__name">Dovli</span>
        </button>
        <button type="button" className="icon-btn sidebar__close" aria-label="Close sidebar" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <label className="search" htmlFor="search">
        <Icon name="search" size={15} />
        <input
          id="search"
          ref={searchRef}
          type="search"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && (setQ(""), searchRef.current?.blur())}
        />
        <kbd className="search__kbd" aria-hidden="true">⌘K</kbd>
      </label>

      <nav className="sidebar__nav" aria-label="Main">
        <button type="button" className={`nav-link${route.name === "home" ? " is-active" : ""}`} onClick={() => go({ name: "home" })}>
          <Icon name="home" />
          Home
        </button>
        <button
          type="button"
          className={`nav-link${route.name === "templates" ? " is-active" : ""}`}
          onClick={() => go({ name: "templates" })}
        >
          <Icon name="templates" />
          Templates
        </button>
      </nav>

      <div className="sidebar__scroll">
        {q.trim() ? (
          <>
            <div className="sidebar__label">
              <span>{results.length ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "No pages match"}</span>
            </div>
            <ul className="tree">
              {results.map((p) => (
                <li key={p.id}>
                  <div className="tree-row" style={{ paddingLeft: 4 }}>
                    <span className="tree-row__chev" />
                    <button
                      type="button"
                      className="tree-row__link"
                      onClick={() => {
                        go({ name: "page", id: p.id });
                        setQ("");
                      }}
                    >
                      <span className="tree-row__mark">{p.mark}</span>
                      <span className="tree-row__title">{displayTitle(p)}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="sidebar__label">
              <span>Pages</span>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                aria-label="New page"
                title="New page"
                onClick={() => {
                  newPage();
                  onClose();
                }}
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
            <ul className="tree">
              {roots.map((p) => (
                <TreeRow key={p.id} page={p} depth={0} onPick={onClose} />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="sidebar__foot">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            newPage();
            onClose();
          }}
        >
          <Icon name="plus" size={15} />
          New page
        </button>
        <p className={`save-status save-status--${status}`}>
          <span className="save-status__dot" aria-hidden="true" />
          {status === "saved" && "Saved on this device"}
          {status === "saving" && "Saving"}
          {status === "error" && "Couldn't save. Browser storage is full or blocked."}
        </p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */
