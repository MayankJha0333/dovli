import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton, cn } from "@dovli/ui";
import { clearMatches, findMatches, paintMatches, replaceAll, replaceOne, scrollToMatch, type Match } from "./findReplace";
import type { DovliEditor } from "./schema";

/** The find-and-replace bar for one page. Enter goes to the next match, Shift+Enter to the previous. */
export function FindBar({ editor, onClose, initialQuery = "" }: { editor: DovliEditor; onClose: () => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCase] = useState(false);
  const [wholeWord, setWhole] = useState(false);
  const [index, setIndex] = useState(0);
  const [version, setVersion] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);

  // Re-search when the page changes underneath us.
  useEffect(() => editor.onChange(() => setVersion((v) => v + 1)), [editor]);
  useEffect(() => {
    findRef.current?.focus();
    findRef.current?.select();
  }, []);

  const matches: Match[] = useMemo(
    () => findMatches(editor, query, { caseSensitive, wholeWord }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query, caseSensitive, wholeWord, version],
  );
  const current = matches.length ? Math.min(index, matches.length - 1) : -1;

  useEffect(() => {
    paintMatches(editor, matches, current);
  }, [editor, matches, current]);
  useEffect(() => () => clearMatches(), []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!matches.length) return;
      const next = (current + dir + matches.length) % matches.length;
      setIndex(next);
      scrollToMatch(editor, matches[next]);
    },
    [matches, current, editor],
  );

  const close = () => {
    clearMatches();
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && e.currentTarget === findRef.current) {
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    }
  };

  const toggle = (on: boolean) =>
    cn("h-7 rounded-sm px-2 text-xs font-semibold transition-colors", on ? "bg-active text-active-ink" : "text-ink-3 hover:bg-hover hover:text-ink");

  return (
    <div
      role="search"
      aria-label="Find in page"
      className="sticky top-2 z-30 mx-auto mb-4 flex w-full max-w-[640px] flex-col gap-2 rounded-lg p-2 text-ink surface-raised animate-pop-in"
    >
      <div className="flex items-center gap-1.5">
        <IconButton
          icon={showReplace ? "chevronDown" : "chevron"}
          label={showReplace ? "Hide replace" : "Show replace"}
          size="sm"
          onClick={() => setShowReplace((s) => !s)}
        />
        <input
          ref={findRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKey}
          placeholder="Find in page"
          aria-label="Find"
          className="h-8 min-w-0 flex-1 rounded-sm border-0 bg-well px-2.5 text-base text-ink outline-none focus:shadow-[0_0_0_2px_var(--d-accent)]"
        />
        <span className="w-[4.5rem] flex-none text-center text-xs tabular-nums text-ink-3" aria-live="polite">
          {query ? (matches.length ? `${current + 1} of ${matches.length}` : "No matches") : ""}
        </span>
        <button type="button" className={toggle(caseSensitive)} aria-pressed={caseSensitive} onClick={() => setCase((v) => !v)} title="Match case">
          Aa
        </button>
        <button type="button" className={toggle(wholeWord)} aria-pressed={wholeWord} onClick={() => setWhole((v) => !v)} title="Whole words only">
          Word
        </button>
        <IconButton icon="arrowUp" label="Previous match" shortcut="⇧↵" size="sm" disabled={!matches.length} onClick={() => go(-1)} />
        <IconButton icon="arrowDown" label="Next match" shortcut="↵" size="sm" disabled={!matches.length} onClick={() => go(1)} />
        <IconButton icon="close" label="Close find" shortcut="Esc" size="sm" onClick={close} />
      </div>
      {showReplace && (
        <div className="flex items-center gap-1.5 pl-[34px]">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter" && matches[current]) {
                e.preventDefault();
                replaceOne(editor, matches[current], replacement);
              }
            }}
            placeholder="Replace with"
            aria-label="Replace with"
            className="h-8 min-w-0 flex-1 rounded-sm border-0 bg-well px-2.5 text-base text-ink outline-none focus:shadow-[0_0_0_2px_var(--d-accent)]"
          />
          <Button size="sm" disabled={!matches[current] || !editor.isEditable} onClick={() => replaceOne(editor, matches[current], replacement)}>
            Replace
          </Button>
          <Button size="sm" variant="primary" disabled={!matches.length || !editor.isEditable} onClick={() => replaceAll(editor, matches, replacement)}>
            Replace all
          </Button>
        </div>
      )}
    </div>
  );
}
