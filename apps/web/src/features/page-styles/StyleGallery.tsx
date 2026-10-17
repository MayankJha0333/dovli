import { useEffect, useRef, useState } from "react";
import { store } from "@/lib/store";
import type { Page } from "@dovli/core";
import { PAGE_STYLES, styleVars, type PageStyle } from "@dovli/theme";
import { Icon } from "@/components/Icon";

export function StyleCard({ s, selected, onPick }: { s: PageStyle | null; selected: boolean; onPick: () => void }) {
  const name = s ? s.name : "Plain";
  return (
    <button
      type="button"
      className={`style-card${selected ? " is-selected" : ""}`}
      onClick={onPick}
      aria-pressed={selected}
    >
      <span className={`style-card__art${s ? "" : " style-card__art--plain"}`} style={s ? styleVars(s) : undefined} aria-hidden="true">
        <span className="style-card__paper">
          <span className="style-card__name">{name}</span>
          <span className="style-card__lines">
            <i /><i /><i />
          </span>
        </span>
        {selected && (
          <span className="style-card__check">
            <Icon name="check" size={13} />
          </span>
        )}
      </span>
      <span className="style-card__label">{name}</span>
    </button>
  );
}

export function StyleGallery({ page, onClose }: { page: Page; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const term = q.trim().toLowerCase();
  const list = PAGE_STYLES.filter((s) => !term || `${s.name} ${s.tags}`.toLowerCase().includes(term));
  const showPlain = !term || "plain original default white".includes(term);
  const pick = (id: string | undefined) => store.updatePage(page.id, { style: id });
  return (
    <div className="gallery-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gallery" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
        <header className="gallery__head">
          <h2 id="gallery-title" className="gallery__title">
            Page style
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <label className="search gallery__search" htmlFor="style-search">
          <Icon name="search" size={15} />
          <input
            id="style-search"
            ref={inputRef}
            type="search"
            placeholder="Search styles, like blue or flowers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="gallery__body">
          {showPlain || list.length ? (
            <div className="gallery__grid">
              {showPlain && <StyleCard s={null} selected={!page.style} onPick={() => pick(undefined)} />}
              {list.map((s) => (
                <StyleCard key={s.id} s={s} selected={page.style === s.id} onPick={() => pick(s.id)} />
              ))}
            </div>
          ) : (
            <p className="empty">No styles match “{q}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}
