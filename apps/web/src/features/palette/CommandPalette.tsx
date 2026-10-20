import { useMemo, useState } from "react";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { ancestors, displayTitle, isLikelyUrl, normalizeUrl, recentPages, searchPages, tagIndex, templates } from "@dovli/core";
import { APP_THEMES } from "@dovli/theme";
import { Icon, Kbd, cn, modKey, type IconName } from "@dovli/ui";
import { settings } from "@/lib/settings";
import { store, useStore } from "@/lib/store";
import { requestTitleFocus, ui, useUI } from "@/lib/ui";
import { exportWorkspace } from "@/lib/transfer";
import { newPage, useFromTemplate } from "@/features/pages/actions";

const item =
  "flex min-h-row cursor-pointer select-none items-center gap-3 rounded-md px-2.5 py-1.5 text-base text-ink-2 outline-none data-[selected=true]:bg-hover data-[selected=true]:text-ink";
const group = "[&_[cmdk-group-heading]]:label-text [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3";

function Row({ icon, mark, title, hint, shortcut, onSelect, value }: { icon?: IconName; mark?: string; title: React.ReactNode; hint?: React.ReactNode; shortcut?: string; onSelect: () => void; value: string }) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={item}>
      <span className="grid size-6 flex-none place-items-center text-ink-3">{mark ? <span className="font-serif text-md">{mark}</span> : icon ? <Icon name={icon} size={16} /> : null}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-ink">{title}</span>
        {hint && <span className="truncate text-xs text-ink-3">{hint}</span>}
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Command.Item>
  );
}

/** ⌘K: jump to any page, search all text, and run any command. */
export function CommandPalette() {
  const open = useUI((s) => s.palette);
  const pages = useStore((s) => s.pages);
  const [q, setQ] = useState("");
  const use = useFromTemplate();
  const mod = modKey();

  const close = () => {
    ui.set({ palette: false });
    setQ("");
  };
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const hits = useMemo(() => (q.trim() ? searchPages(pages, q, 20) : []), [pages, q]);
  const recent = useMemo(() => (q.trim() ? [] : recentPages(pages, 6)), [pages, q]);
  const tags = useMemo(() => tagIndex(pages).slice(0, 30), [pages]);
  const term = q.trim().toLowerCase();
  const matches = (s: string) => !term || s.toLowerCase().includes(term);

  const commands: { id: string; icon: IconName; title: string; keywords: string; shortcut?: string; run: () => void }[] = [
    { id: "new", icon: "page", title: "New page", keywords: "create add page document", shortcut: `${mod}⌥N`, run: () => newPage() },
    { id: "board", icon: "board", title: "New whiteboard", keywords: "create canvas draw board", run: () => newPage("board") },
    { id: "home", icon: "home", title: "Go to Home", keywords: "home start", run: () => store.navigate({ name: "home" }) },
    { id: "templates", icon: "templates", title: "Browse templates", keywords: "templates", run: () => store.navigate({ name: "templates" }) },
    { id: "link", icon: "link", title: "Notes from a link", keywords: "web website url article clip save read summarise summarize notes link", run: () => ui.set({ linkNotes: { parentId: null } }) },
    { id: "trash", icon: "trash", title: "Open trash", keywords: "trash deleted restore bin", run: () => store.navigate({ name: "trash" }) },
    { id: "settings", icon: "settings", title: "Settings", keywords: "settings preferences options", shortcut: `${mod},`, run: () => ui.set({ settings: "appearance" }) },
    { id: "account", icon: "user", title: "Account and sign in", keywords: "account sign in login sync google apple email", run: () => ui.set({ settings: "account" }) },
    { id: "import", icon: "importIcon", title: "Import from Notion or Markdown", keywords: "import notion markdown zip upload", run: () => ui.set({ settings: "data" }) },
    { id: "export", icon: "download", title: "Export everything", keywords: "export download backup zip markdown html", run: () => void exportWorkspace() },
    { id: "shortcuts", icon: "keyboard", title: "Keyboard shortcuts", keywords: "keys shortcuts help", run: () => ui.set({ settings: "shortcuts" }) },
  ];
  const route = store.get().route;
  if (route.name === "page" && pages[route.id]) {
    const p = pages[route.id];
    commands.unshift(
      { id: "fav", icon: p.favorite ? "starFilled" : "star", title: p.favorite ? "Remove page from favourites" : "Add page to favourites", keywords: "favourite star pin", run: () => store.toggleFavorite(p.id) },
      { id: "share", icon: "share", title: "Share this page", keywords: "share link publish", run: () => ui.set({ share: p.id }) },
      { id: "style", icon: "palette", title: "Change page style", keywords: "style look backdrop theme page", run: () => ui.set({ styleFor: p.id }) },
    );
  }

  return (
    <D.Root open={open} onOpenChange={(o) => (o ? ui.set({ palette: true }) : close())}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[300] bg-overlay animate-fade-in" />
        <D.Content
          aria-label="Search and commands"
          className="fixed left-1/2 top-[12vh] z-[301] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl text-ink surface-raised animate-pop-in focus:outline-none max-[640px]:top-3"
        >
          <D.Title className="sr-only">Search and commands</D.Title>
          <D.Description className="sr-only">Type to search pages and commands. Use the arrow keys and Enter.</D.Description>
          <Command label="Search and commands" shouldFilter={false} loop className="flex max-h-[min(560px,76vh)] flex-col">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Icon name="search" size={17} className="text-ink-3" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Search pages, or type a command"
                className="h-14 min-w-0 flex-1 border-0 bg-transparent text-lg text-ink outline-none placeholder:text-ink-4"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-1.5 [scroll-padding-block:8px]">
              <Command.Empty className="px-3 py-10 text-center text-sm text-ink-3">Nothing here yet. Start typing to search.</Command.Empty>

              {recent.length > 0 && (
                <Command.Group heading="Recent" className={group}>
                  {recent.map((p) => (
                    <Row key={p.id} value={`recent-${p.id}`} mark={p.mark} title={displayTitle(p)} hint={ancestors(pages, p.id).map((a) => displayTitle(a)).join(" / ") || undefined} onSelect={run(() => store.navigate({ name: "page", id: p.id }))} />
                  ))}
                </Command.Group>
              )}

              {hits.length > 0 && (
                <Command.Group heading="Pages" className={group}>
                  {hits.map(({ page: p, snippet }) => (
                    <Row
                      key={p.id}
                      value={`page-${p.id}`}
                      mark={p.mark}
                      title={displayTitle(p)}
                      hint={
                        snippet ? (
                          <>
                            {snippet.text.slice(0, snippet.start)}
                            <mark className="rounded-xs bg-accent-soft px-px text-accent">{snippet.text.slice(snippet.start, snippet.end)}</mark>
                            {snippet.text.slice(snippet.end)}
                          </>
                        ) : (
                          ancestors(pages, p.id).map((a) => displayTitle(a)).join(" / ") || undefined
                        )
                      }
                      onSelect={run(() => store.navigate({ name: "page", id: p.id }))}
                    />
                  ))}
                </Command.Group>
              )}

              {term && (
                <Command.Group heading="Create" className={group}>
                  {isLikelyUrl(q) && (
                    <Row value="create-link-notes" icon="link" title="Make notes from this link" hint={q.trim()} onSelect={run(() => ui.set({ linkNotes: { parentId: null, url: normalizeUrl(q) } }))} />
                  )}
                  <Row
                    value="create-page"
                    icon="pagePlus"
                    title={`New page “${q.trim()}”`}
                    onSelect={run(() => {
                      const p = store.createPage({ title: q.trim() });
                      requestTitleFocus(p.id);
                      store.navigate({ name: "page", id: p.id });
                    })}
                  />
                </Command.Group>
              )}

              {commands.filter((c) => matches(`${c.title} ${c.keywords}`)).length > 0 && (
                <Command.Group heading="Commands" className={group}>
                  {commands
                    .filter((c) => matches(`${c.title} ${c.keywords}`))
                    .map((c) => (
                      <Row key={c.id} value={`cmd-${c.id}`} icon={c.icon} title={c.title} shortcut={c.shortcut} onSelect={run(c.run)} />
                    ))}
                </Command.Group>
              )}

              {APP_THEMES.filter((t) => matches(`theme ${t.name} dark light appearance`)).length > 0 && term && (
                <Command.Group heading="Theme" className={group}>
                  {APP_THEMES.filter((t) => matches(`theme ${t.name} dark light appearance`)).map((t) => (
                    <Row key={t.id} value={`theme-${t.id}`} icon={t.scheme === "dark" ? "moon" : "sun"} title={`Theme: ${t.name}`} hint={t.description} onSelect={run(() => settings.set({ theme: t.id }))} />
                  ))}
                  {matches("theme match device system auto") && <Row value="theme-system" icon="monitor" title="Theme: Match device" onSelect={run(() => settings.set({ theme: "system" }))} />}
                </Command.Group>
              )}

              {term && templates.filter((t) => matches(`template ${t.name} ${t.description}`)).length > 0 && (
                <Command.Group heading="Templates" className={group}>
                  {templates
                    .filter((t) => matches(`template ${t.name} ${t.description}`))
                    .slice(0, 5)
                    .map((t) => (
                      <Row key={t.id} value={`tpl-${t.id}`} mark={t.mark} title={t.name} hint={t.description} onSelect={run(() => use(t))} />
                    ))}
                </Command.Group>
              )}

              {term && tags.filter((t) => matches(`#${t.tag} tag`)).length > 0 && (
                <Command.Group heading="Tags" className={group}>
                  {tags
                    .filter((t) => matches(`#${t.tag} tag`))
                    .slice(0, 6)
                    .map((t) => (
                      <Row key={t.tag} value={`tag-${t.tag}`} icon="hash" title={t.tag} hint={`${t.pages.length} page${t.pages.length > 1 ? "s" : ""}`} onSelect={run(() => store.navigate({ name: "tag", tag: t.tag }))} />
                    ))}
                </Command.Group>
              )}
            </Command.List>
            <div className={cn("flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-3 max-[640px]:hidden")}>
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to move
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> to open
              </span>
              <span className="ml-auto">Search looks inside every page</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
