// Find and replace in the sidebar, like Craft's (DocumentSidebar_FindAndReplaceView): a search box,
// what to search ("Text in this page", or this page and the pages inside it, as Craft's "in
// document"), Match case / Whole words / Ignore accents / Regular expression, "3 / 12 results"
// with ↑ ↓, the matches listed with the words around them, and Replace / Replace all.
// Matches in the open page are lit up in the text; the current one is stronger.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMatcher,
  clearMatches,
  findMatches,
  matchText,
  paintMatches,
  replaceAll,
  replaceOne,
  scrollToMatch,
  snippetOf,
  type DovliEditor,
  type Match,
  type Matcher,
  type Snippet,
} from "@dovli/editor";
import { descendantIds, displayTitle, inlineText, type Page } from "@dovli/core";
import { Button, Icon, IconButton, MenuCheckboxItem, MenuContent, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger, cn, modKey, toast } from "@dovli/ui";
import { find, useFind, type FindState } from "@/lib/find";
import { store, useStore } from "@/lib/store";
import { ui, useActiveEditor } from "@/lib/ui";

type Found = { blockId?: string; snippet: Snippet };
type Result = {
  pageId: string;
  live: boolean;
  match: Match | null;
  found: Found;
};
type Group = { page: Page; live: boolean; results: Result[] };

type Hit = Exclude<Matcher, null | { error: string }>;

/** Matches in a page that isn't open, from its saved blocks. */
function savedMatches(page: Page, m: Hit): Found[] {
  const out: Found[] = [];
  const add = (text: string, blockId?: string) => {
    for (const [s, e] of matchText(text, m)) out.push({ blockId, snippet: snippetOf(text, s, e) });
  };
  const walk = (blocks: any[]) => {
    for (const b of blocks ?? []) {
      if (Array.isArray(b.content) || typeof b.content === "string") add(inlineText(b.content), b.id);
      else if (b.content?.type === "tableContent")
        for (const row of b.content.rows ?? []) for (const cell of row.cells ?? []) add(inlineText(Array.isArray(cell) ? cell : (cell?.content ?? [])), b.id);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(page.blocks ?? []);
  return out;
}

/** Replace inside a page that isn't open: within each run of text (a match split across bold and plain text is left alone). */
function replaceInBlocks(blocks: any[], m: Hit, text: string): [any[], number] {
  let count = 0;
  const one = new RegExp(m.re.source, m.re.flags.replace("g", ""));
  const swap = (found: string) => (/\$[\d&<]/.test(text) && one.test(found) ? found.replace(one, text) : text);
  const runs = (content: any[]): any[] =>
    content.map((c) => {
      if (c?.type === "text" && typeof c.text === "string") {
        const hits = matchText(c.text, m);
        if (!hits.length) return c;
        let out = "";
        let at = 0;
        for (const [s, e] of hits) {
          out += c.text.slice(at, s) + swap(c.text.slice(s, e));
          at = e;
        }
        count += hits.length;
        return { ...c, text: out + c.text.slice(at) };
      }
      if (c?.type === "link" && Array.isArray(c.content)) return { ...c, content: runs(c.content) };
      return c;
    });
  const walk = (list: any[]): any[] =>
    list.map((b) => {
      let next = b;
      if (Array.isArray(b.content)) next = { ...next, content: runs(b.content) };
      else if (b.content?.type === "tableContent")
        next = {
          ...next,
          content: {
            ...b.content,
            rows: (b.content.rows ?? []).map((r: any) => ({
              ...r,
              cells: (r.cells ?? []).map((cell: any) => (Array.isArray(cell) ? runs(cell) : cell?.content ? { ...cell, content: runs(cell.content) } : cell)),
            })),
          },
        };
      if (b.children?.length) next = { ...next, children: walk(b.children) };
      return next;
    });
  return [walk(blocks), count];
}

const SCOPE_LABEL = {
  page: "this page",
  tree: "this page and pages inside",
} as const;

function OptionsMenu({ s }: { s: FindState }) {
  const what = s.regex ? "Pattern" : "Text";
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Search options: ${what} in ${SCOPE_LABEL[s.scope]}`}
          className="flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink"
        >
          <span className="truncate">
            {what} in {SCOPE_LABEL[s.scope]}
          </span>
          <Icon name="chevronDown" size={12} className="flex-none text-ink-3" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Search in</MenuLabel>
        <MenuCheckboxItem checked={s.scope === "page"} onCheckedChange={() => find.set({ scope: "page" })}>
          This page
        </MenuCheckboxItem>
        <MenuCheckboxItem checked={s.scope === "tree"} onCheckedChange={() => find.set({ scope: "tree" })}>
          This page and pages inside
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuCheckboxItem checked={s.caseSensitive} onCheckedChange={(v) => find.set({ caseSensitive: !!v })}>
          Match case
        </MenuCheckboxItem>
        <MenuCheckboxItem checked={s.wholeWord} onCheckedChange={(v) => find.set({ wholeWord: !!v })}>
          Whole words only
        </MenuCheckboxItem>
        <MenuCheckboxItem checked={s.ignoreAccents} onCheckedChange={(v) => find.set({ ignoreAccents: !!v })}>
          Ignore accents (é = e)
        </MenuCheckboxItem>
        <MenuCheckboxItem checked={s.regex} onCheckedChange={(v) => find.set({ regex: !!v })}>
          Regular expression
        </MenuCheckboxItem>
      </MenuContent>
    </MenuRoot>
  );
}

const field =
  "h-8 w-full min-w-0 rounded-md border-0 bg-well pl-8 pr-7 text-base text-ink outline-none transition-shadow placeholder:text-ink-4 focus:shadow-[0_0_0_2px_var(--d-accent)]";

export function FindTab({ page }: { page: Page }) {
  const s = useFind((x) => x);
  const pages = useStore((st) => st.pages);
  const { editor, pageId: livePageId } = useActiveEditor<DovliEditor>();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [version, setVersion] = useState(0);
  const [cur, setCur] = useState(0);
  const pending = useRef<{
    pageId: string;
    blockId?: string;
    nth: number;
  } | null>(null);

  // "This page and pages inside" keeps the page it started from, so opening a result inside
  // doesn't change the list under you.
  const [root, setRoot] = useState(page.id);
  useEffect(() => {
    if (page.id !== root && !descendantIds(pages, root).includes(page.id)) setRoot(page.id);
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rootId = s.scope === "tree" ? root : page.id;

  useEffect(() => (editor ? editor.onChange(() => setVersion((v) => v + 1)) : undefined), [editor]);
  // Put the cursor in the search box. On a phone the sidebar is still sliding in (and can't take
  // focus yet), so try again for a moment.
  useEffect(() => {
    const timers = [0, 90, 240].map((ms) =>
      window.setTimeout(() => {
        const el = input.current;
        if (!el || document.activeElement === el) return;
        el.focus();
        el.select();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [s.focusTick]);

  const opts = {
    caseSensitive: s.caseSensitive,
    wholeWord: s.wholeWord,
    regex: s.regex,
    ignoreAccents: s.ignoreAccents,
  };
  const matcher = useMemo(() => buildMatcher(s.query, opts), [s.query, s.caseSensitive, s.wholeWord, s.regex, s.ignoreAccents]); // eslint-disable-line react-hooks/exhaustive-deps
  const error = matcher && "error" in matcher ? matcher.error : null;

  const groups: Group[] = useMemo(() => {
    if (!matcher || "error" in matcher) return [];
    const ids = s.scope === "tree" ? [rootId, ...descendantIds(pages, rootId).filter((id) => pages[id] && !pages[id].deletedAt && pages[id].kind === "doc")] : [page.id];
    return ids
      .map((id): Group | null => {
        const p = pages[id];
        if (!p) return null;
        const live = id === livePageId && !!editor;
        const results: Result[] = live
          ? findMatches(editor!, s.query, opts).map((m) => ({
              pageId: id,
              live,
              match: m,
              found: { blockId: m.blockId, snippet: m.snippet! },
            }))
          : savedMatches(p, matcher).map((f) => ({
              pageId: id,
              live,
              match: null,
              found: f,
            }));
        return { page: p, live, results };
      })
      .filter((g): g is Group => !!g && g.results.length > 0);
  }, [matcher, pages, editor, livePageId, version, rootId, s.scope, page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups]);
  const at = flat.length ? Math.min(cur, flat.length - 1) : -1;
  const live = groups.find((g) => g.live);
  const liveMatches = live ? live.results.map((r) => r.match!) : [];

  // A new search starts at the first match in the open page.
  useEffect(() => {
    const first = flat.findIndex((r) => r.pageId === page.id);
    setCur(first < 0 ? 0 : first);
  }, [s.query, s.caseSensitive, s.wholeWord, s.regex, s.ignoreAccents, s.scope]); // eslint-disable-line react-hooks/exhaustive-deps

  // After opening a result on another page, pick it up once that page's editor is ready.
  useEffect(() => {
    const p = pending.current;
    if (!p || livePageId !== p.pageId || !editor) return;
    let seen = 0;
    const i = flat.findIndex((r) => r.pageId === p.pageId && r.found.blockId === p.blockId && seen++ === p.nth);
    pending.current = null;
    if (i >= 0) {
      setCur(i);
      requestAnimationFrame(() => scrollToMatch(editor, flat[i].match!));
    }
  }, [flat, livePageId, editor]);

  // Light up the matches in the open page.
  useEffect(() => {
    if (!editor || !liveMatches.length) return clearMatches();
    const r = flat[at];
    paintMatches(editor, liveMatches, r?.live ? live!.results.indexOf(r) : -1);
  }, [editor, flat, at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearMatches(), []);

  // Keep the current result in view in the list.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const select = (i: number) => {
    const r = flat[i];
    if (!r) return;
    setCur(i);
    // On a phone the sidebar covers the page: put it away so the match can be seen.
    if (window.matchMedia("(max-width: 860px)").matches) ui.set({ nav: false });
    if (r.live && editor) return scrollToMatch(editor, r.match!);
    // A match on another page: open it, then jump to the match there.
    let nth = 0;
    for (const x of flat) {
      if (x === r) break;
      if (x.pageId === r.pageId && x.found.blockId === r.found.blockId) nth++;
    }
    pending.current = { pageId: r.pageId, blockId: r.found.blockId, nth };
    store.navigate({ name: "page", id: r.pageId });
  };
  const go = (dir: 1 | -1) => flat.length && select((at + dir + flat.length) % flat.length);

  // ⌘G / ⌘⇧G from anywhere in the page.
  const lastStep = useRef(s.step.n);
  useEffect(() => {
    if (s.step.n === lastStep.current) return;
    lastStep.current = s.step.n;
    go(s.step.dir);
  }, [s.step.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    find.close();
    editor?.focus();
  };

  const canEdit = !!editor?.isEditable;
  const replaceCurrent = () => {
    const r = flat[at];
    if (!r?.live || !editor || !matcher || "error" in matcher) return;
    replaceOne(editor, r.match!, s.replacement, matcher);
  };
  const replaceEverything = () => {
    if (!matcher || "error" in matcher) return;
    let n = editor && liveMatches.length ? replaceAll(editor, liveMatches, s.replacement, matcher) : 0;
    let pagesChanged = 0;
    for (const g of groups) {
      if (g.live) continue;
      const [blocks, count] = replaceInBlocks(g.page.blocks ?? [], matcher, s.replacement);
      if (!count) continue;
      store.updatePage(g.page.id, { blocks });
      n += count;
      pagesChanged++;
    }
    if (n) toast(`Replaced ${n} ${n === 1 ? "match" : "matches"}${pagesChanged ? ` (${pagesChanged} other ${pagesChanged === 1 ? "page" : "pages"})` : ""}`);
  };

  const summary = !s.query ? "" : error ? error : flat.length ? `${at + 1} / ${flat.length} ${flat.length === 1 ? "result" : "results"}` : "No results";
  const showGroups = s.scope === "tree";

  return (
    <div
      role="search"
      aria-label="Find in page"
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        // Esc anywhere in Find closes it (the search box handles its own keys first).
        if (e.key === "Escape" && !e.defaultPrevented && !(e.target as HTMLElement).closest("[role=menu]")) {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="flex flex-col gap-1.5 px-0.5">
        <div className="relative">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={input}
            type="search"
            value={s.query}
            onChange={(e) => find.set({ query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder="Find"
            aria-label="Find"
            aria-describedby="find-summary"
            spellCheck={false}
            className={field}
          />
          {s.query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                find.set({ query: "" });
                input.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-ink-4/40 text-panel hover:bg-ink-3"
            >
              <Icon name="close" size={10} />
            </button>
          )}
        </div>
        {s.showReplace && (
          <div className="relative">
            <Icon name="replace" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={s.replacement}
              onChange={(e) => find.set({ replacement: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  replaceCurrent();
                }
              }}
              placeholder="Replace with"
              aria-label="Replace with"
              spellCheck={false}
              className={field}
            />
          </div>
        )}
        <div className="flex items-center gap-1">
          <OptionsMenu s={s} />
          <button
            type="button"
            aria-pressed={s.showReplace}
            onClick={() => find.set({ showReplace: !s.showReplace })}
            className={cn(
              "ml-auto h-7 flex-none rounded-md px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink",
              s.showReplace && "bg-active text-active-ink",
            )}
          >
            Replace
          </button>
        </div>
        {s.showReplace && (
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="secondary" disabled={!flat[at]?.live || !canEdit} onClick={replaceCurrent}>
              Replace
            </Button>
            <Button size="sm" variant="secondary" disabled={!flat.length || !canEdit} onClick={replaceEverything}>
              Replace all
            </Button>
          </div>
        )}
      </div>

      <div className="mt-2 flex h-8 items-center gap-1 border-t border-line px-1.5 pt-1">
        <span id="find-summary" aria-live="polite" className={cn("min-w-0 flex-1 truncate text-xs tabular-nums", error ? "text-danger" : "text-ink-3")}>
          {summary}
        </span>
        <IconButton icon="chevronUp" label="Previous match" shortcut="⇧↵" size="xs" disabled={!flat.length} onClick={() => go(-1)} />
        <IconButton icon="chevronDown" label="Next match" shortcut={`↵  ${modKey()}G`} size="xs" disabled={!flat.length} onClick={() => go(1)} />
        <IconButton icon="close" label="Close find" shortcut="Esc" size="xs" onClick={close} />
      </div>

      <ul ref={list} aria-label="Results" className="-mx-1 m-0 min-h-0 flex-1 list-none overflow-y-auto px-1 pb-2 pt-0.5">
        {!s.query && (
          <li className="px-2.5 py-3 text-sm leading-relaxed text-ink-3">
            Type to find words in {s.scope === "tree" ? "this page and the pages inside it" : "this page"}. Enter goes to the next one.
          </li>
        )}
        {groups.map((g) => (
          <li key={g.page.id} className="mb-1">
            {showGroups && (
              <button
                type="button"
                onClick={() => store.navigate({ name: "page", id: g.page.id })}
                className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs font-semibold text-ink-2 hover:bg-hover hover:text-ink"
              >
                <span className="w-4 flex-none text-center font-serif text-ink-3">{g.page.mark}</span>
                <span className="min-w-0 flex-1 truncate">{displayTitle(g.page)}</span>
                <span className="tabular-nums text-ink-3">{g.results.length}</span>
              </button>
            )}
            <ul className="m-0 flex list-none flex-col gap-px p-0">
              {g.results.slice(0, 300).map((r) => {
                const i = flat.indexOf(r);
                const on = i === at;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-current={on ? "true" : undefined}
                      onClick={() => select(i)}
                      className={cn(
                        "block w-full rounded-md px-2.5 py-1.5 text-left text-sm leading-snug text-ink-2 transition-colors hover:bg-hover",
                        on && "bg-active text-active-ink shadow-active hover:bg-active",
                      )}
                    >
                      <span className="line-clamp-2 break-words">
                        {r.found.snippet.before}
                        <mark className="rounded-[3px] bg-[color-mix(in_srgb,var(--d-warn)_38%,transparent)] px-px font-semibold text-ink">{r.found.snippet.hit}</mark>
                        {r.found.snippet.after}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
