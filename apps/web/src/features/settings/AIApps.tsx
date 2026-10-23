// Settings → AI apps, in the spirit of Craft's "Your MCP Connections": connect Claude Desktop,
// Claude Code, Codex or another AI app to your pages through Dovli's MCP server.
//
// One guided flow makes a connection: 1 · which app, 2 · what it can reach and do, 3 · connect
// (its private address, shown once, and the steps for that app). The same pieces are used all
// the way through: app tiles, choice cards, the address field and code boxes with a Copy button.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { displayTitle, timeAgo, type Page } from "@dovli/core";
import { Button, Dialog, Icon, IconButton, Input, MenuContent, MenuItem, MenuRoot, MenuTrigger, Segmented, Spinner, Switch, cn, toast, type IconName } from "@dovli/ui";
import { aiApps, TOOL_WORDS, type AIAppConnection, type AIAppInput, type AppKind } from "@/lib/aiApps";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ui } from "@/lib/ui";
import { Group } from "./sections";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

const APPS: Record<AppKind, { name: string; hint: string; icon: IconName }> = {
  "claude-desktop": { name: "Claude Desktop", hint: "The Claude app on Mac or Windows", icon: "monitor" },
  "claude-code": { name: "Claude Code", hint: "Claude in your Terminal", icon: "keyboard" },
  codex: { name: "Codex", hint: "OpenAI's coding agent", icon: "code" },
  other: { name: "Other app", hint: "Cursor, VS Code, ChatGPT…", icon: "plug" },
};
const APP_IDS = Object.keys(APPS) as AppKind[];

/* ------------------------------------------------------------------ */
/* Small pieces, used everywhere on this screen                        */
/* ------------------------------------------------------------------ */

function AppTile({ app, size = "md" }: { app: AppKind; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-8 rounded-md", md: "size-10 rounded-lg", lg: "size-12 rounded-xl" }[size];
  return (
    <span className={cn("grid flex-none place-items-center bg-panel text-accent shadow-sm", box)} aria-hidden="true">
      <Icon name={APPS[app]?.icon ?? "plug"} size={size === "lg" ? 22 : size === "md" ? 18 : 15} />
    </span>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Couldn't copy. Select the text and copy it yourself.", { tone: "danger" });
    }
  };
  return { copied, copy };
}

/** A box of text to paste somewhere (a command, a settings file), with a header and a Copy button. */
function CodeBox({ title, label, value }: { title: string; label: string; value: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="overflow-hidden rounded-lg bg-well shadow-[inset_0_0_0_1px_var(--d-line)]">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-line pl-3 pr-1.5">
        <span className="truncate font-mono text-xs text-ink-3">{title}</span>
        <Button size="sm" variant="ghost" icon={copied ? "check" : "copy"} onClick={() => copy(value)} aria-label={`Copy ${label}`} className="h-7 flex-none">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre aria-label={label} tabIndex={0} className="m-0 overflow-x-auto whitespace-pre px-3 py-2.5 font-mono text-xs leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
        {value}
      </pre>
    </div>
  );
}

/** The connection's private address, with Copy beside it (not on top of it). */
function AddressField({ url }: { url: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-well px-3 shadow-[inset_0_0_0_1px_var(--d-line)]">
        <Icon name="lock" size={14} className="flex-none text-ink-3" />
        <pre aria-label="Dovli address" tabIndex={0} className="m-0 min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-ink [scrollbar-width:none] focus-visible:outline-none">
          {url}
        </pre>
      </div>
      <Button variant="primary" icon={copied ? "check" : "copy"} onClick={() => copy(url)} className="h-10 flex-none">
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** A big choice (an app, or what a connection may do), picked like a radio button. */
function ChoiceCards<T extends string>({ label, value, onChange, options, stackOnPhone = true }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; title: string; hint: string; icon?: ReactNode }[]; stackOnPhone?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-2 gap-2", stackOnPhone && "max-[480px]:grid-cols-1")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = options[(i + step + options.length) % options.length];
              onChange(next.value);
              (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}
            tabIndex={on ? 0 : -1}
            className={cn(
              "relative flex min-w-0 flex-col items-start gap-2 rounded-lg bg-well p-3 text-left transition-shadow hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              on && "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--d-accent)] hover:bg-accent-soft",
            )}
          >
            {o.icon}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">{o.title}</span>
              <span className="text-xs leading-snug text-ink-3">{o.hint}</span>
            </span>
            {on && (
              <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 flex-none place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent" aria-hidden="true">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </li>
  );
}

const Key = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>;
const Mono = ({ children }: { children: ReactNode }) => <code className="rounded-[4px] bg-well px-1 py-px font-mono text-[0.85em] text-ink">{children}</code>;

/* ------------------------------------------------------------------ */
/* Setup steps for each app                                            */
/* ------------------------------------------------------------------ */

function SetupSteps({ app, url }: { app: AppKind; url: string }) {
  const local = /\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  // The bridge as an npm package (next.config.ts); the version makes npx fetch a new one, not reuse its cache.
  const version = process.env.NEXT_PUBLIC_MCP_BRIDGE_VERSION;
  const bridge = url.replace(/\/api\/mcp\/.*$/, version ? `/dovli-mcp-${version}.tgz` : "/dovli-mcp.tgz");
  const command = `npx -y ${bridge} ${url}`;
  const desktop = JSON.stringify({ mcpServers: { dovli: { command: "npx", args: ["-y", bridge, url] } } }, null, 2);
  const [withConfigFile, setWithConfigFile] = useState(local);
  return (
    <div className="flex flex-col gap-4">
      {app === "claude-desktop" && !withConfigFile && (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          <Step n={1}>
            <p className="m-0">
              In Claude open <Key>Settings → Connectors → Add custom connector</Key>.
            </p>
          </Step>
          <Step n={2}>
            <p className="m-0">
              Name it <Mono>Dovli</Mono>, paste the address above as its URL and click <Key>Add</Key>. Nothing else to fill in: the address is the key.
            </p>
          </Step>
          <Step n={3}>
            <p className="m-0">Dovli is in the tools menu of a new chat, on the Claude app and claude.ai.</p>
            <button type="button" onClick={() => setWithConfigFile(true)} className="w-fit text-xs font-medium text-accent hover:underline">
              No Connectors in your Claude? Use its settings file instead
            </button>
          </Step>
        </ol>
      )}
      {app === "claude-desktop" && withConfigFile && (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          <Step n={1}>
            <p className="m-0">
              In Claude Desktop open <Key>Settings → Developer → Edit Config</Key> and paste this in. It's ready as it is: nothing to download or fill in.
            </p>
            <CodeBox title="claude_desktop_config.json" label="Claude Desktop settings" value={desktop} />
            <p className="m-0 text-xs text-ink-3">
              Already have other servers there? Add the <Mono>"dovli"</Mono> part inside your <Mono>"mcpServers"</Mono>. It needs{" "}
              <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                Node.js
              </a>{" "}
              on this computer.
            </p>
          </Step>
          <Step n={2}>
            <p className="m-0">Quit and reopen Claude Desktop. Dovli is in the tools menu of a new chat.</p>
            {!local && (
              <button type="button" onClick={() => setWithConfigFile(false)} className="w-fit text-xs font-medium text-accent hover:underline">
                Use Claude's Connectors instead (no settings file)
              </button>
            )}
          </Step>
        </ol>
      )}
      {app === "claude-code" && (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          <Step n={1}>
            <p className="m-0">Run this once in Terminal. It adds Dovli for all your projects.</p>
            <CodeBox title="Terminal" label="Claude Code command" value={`claude mcp add --transport http --scope user dovli ${url}`} />
          </Step>
          <Step n={2}>
            <p className="m-0">
              Start <Mono>claude</Mono> and type <Mono>/mcp</Mono> to check that Dovli is connected.
            </p>
          </Step>
        </ol>
      )}
      {app === "codex" && (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          <Step n={1}>
            <p className="m-0">
              Add this to <Mono>~/.codex/config.toml</Mono>. Make the file if it isn't there.
            </p>
            <CodeBox title="~/.codex/config.toml" label="Codex settings" value={`[mcp_servers.dovli]\nurl = "${url}"`} />
          </Step>
          <Step n={2}>
            <p className="m-0">
              Start <Mono>codex</Mono> again and type <Mono>/mcp</Mono> to see Dovli's tools.
            </p>
            <p className="m-0 text-xs text-ink-3">
              Older Codex? Run <Mono>codex mcp add dovli -- {command}</Mono>
            </p>
          </Step>
        </ol>
      )}
      {app === "other" && (
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p className="m-0">In Cursor, Windsurf, VS Code, ChatGPT or any app that supports MCP, add a server with these details:</p>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-well px-4 py-3">
            <dt className="text-ink-3">Address</dt>
            <dd className="m-0 text-ink">The one above</dd>
            <dt className="text-ink-3">Type</dt>
            <dd className="m-0 text-ink">HTTP (Streamable HTTP)</dd>
            <dt className="text-ink-3">Sign-in</dt>
            <dd className="m-0 text-ink">None: the address is the key</dd>
          </dl>
          <p className="m-0 text-xs text-ink-3">
            App wants a key in a header? Use <Mono>{url.replace(/\/dvl_[^/]+$/, "")}</Mono> with the header <Mono>Authorization: Bearer {url.match(/dvl_[^/]+$/)?.[0] ?? "dvl_…"}</Mono>.
          </p>
          <p className="m-0 text-xs text-ink-3">For apps that run a command instead (nothing to download):</p>
          <CodeBox title="Command" label="Command for apps that start MCP servers" value={command} />
        </div>
      )}
      <p className="m-0 flex gap-2 rounded-lg bg-well px-3 py-2.5 text-xs leading-relaxed text-ink-2">
        <Icon name="info" size={14} className="mt-px flex-none text-ink-3" />
        {local
          ? "Dovli is running on this computer, so AI apps on this computer can use it. Apps that run in the cloud (ChatGPT, Claude's custom connectors) need Dovli to be online."
          : "Your AI app asks before it changes anything, unless you tell it not to. To check the address, open it in a browser: it says whether it works."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choosing pages                                                      */
/* ------------------------------------------------------------------ */

function PageChooser({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const pages = useStore((s) => s.pages);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const live = Object.values(pages).filter((p) => !p.deletedAt);
    const kids = (id: string | null) => live.filter((p) => p.parentId === id).sort((a, b) => a.order - b.order);
    const out: { page: Page; depth: number }[] = [];
    const walk = (id: string | null, depth: number) => {
      for (const p of kids(id)) {
        out.push({ page: p, depth });
        if (depth < 3) walk(p.id, depth + 1);
      }
    };
    walk(null, 0);
    const f = q.trim().toLowerCase();
    return f ? out.filter((r) => displayTitle(r.page).toLowerCase().includes(f)).map((r) => ({ ...r, depth: 0 })) : out;
  }, [pages, q]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--d-line)]">
      <div className="relative border-b border-line">
        <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter pages"
          aria-label="Filter pages"
          className="h-10 w-full border-0 bg-transparent pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-4"
        />
      </div>
      <ul aria-label="Pages this connection can reach" className="m-0 max-h-52 list-none overflow-y-auto p-1">
        {rows.map(({ page, depth }) => {
          const on = value.includes(page.id);
          return (
            <li key={page.id}>
              <label className={cn("flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md pr-2 text-sm text-ink hover:bg-hover", on && "bg-accent-soft hover:bg-accent-soft")} style={{ paddingLeft: 10 + depth * 18 }}>
                <input type="checkbox" checked={on} onChange={() => toggle(page.id)} className="size-4 flex-none accent-[var(--d-accent)]" />
                <span className="w-4 flex-none text-center font-serif text-ink-3">{page.mark}</span>
                <span className="truncate">{displayTitle(page)}</span>
              </label>
            </li>
          );
        })}
        {!rows.length && <li className="px-3 py-4 text-sm text-ink-3">No pages match.</li>}
      </ul>
      <p className="m-0 border-t border-line px-3 py-2 text-xs text-ink-3">{value.length ? `${value.length} chosen · the pages inside them are included` : "Choose at least one page · the pages inside it are included"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The flow: which app → access → connect                              */
/* ------------------------------------------------------------------ */

type Flow = { mode: "new" } | { mode: "edit"; connection: AIAppConnection } | { mode: "connect"; connection: AIAppConnection; url: string };
type StepId = "app" | "access" | "connect";
const STEPS: { id: StepId; label: string }[] = [
  { id: "app", label: "App" },
  { id: "access", label: "Access" },
  { id: "connect", label: "Connect" },
];

function Stepper({ at }: { at: StepId }) {
  const i = STEPS.findIndex((s) => s.id === at);
  return (
    <ol aria-label={`Step ${i + 1} of 3`} className="m-0 mb-5 flex list-none items-center gap-2 p-0 text-xs font-medium">
      {STEPS.map((s, k) => (
        <li key={s.id} className="flex items-center gap-2" aria-current={k === i ? "step" : undefined}>
          {k > 0 && <span aria-hidden="true" className={cn("h-px w-6", k <= i ? "bg-accent" : "bg-line-strong")} />}
          <span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-bold", k < i ? "bg-accent text-accent-ink" : k === i ? "bg-accent-soft text-accent shadow-[inset_0_0_0_1.5px_var(--d-accent)]" : "bg-well text-ink-3")}>
            {k < i ? <Icon name="check" size={11} /> : k + 1}
          </span>
          <span className={k === i ? "text-ink" : "text-ink-3"}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function ConnectionFlow({ flow, onClose, onSaved }: { flow: Flow | null; onClose: () => void; onSaved: (c: AIAppConnection, url?: string) => void }) {
  const editing = flow?.mode === "edit" ? flow.connection : null;
  const [step, setStep] = useState<StepId>("app");
  const [app, setApp] = useState<AppKind>("claude-desktop");
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [scope, setScope] = useState<"all" | "pages">("all");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [permission, setPermission] = useState<"view" | "edit">("edit");
  const [made, setMade] = useState<{ connection: AIAppConnection; url: string } | null>(null);
  const [setupApp, setSetupApp] = useState<AppKind>("claude-desktop");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!flow) return;
    const c = flow.mode === "new" ? null : flow.connection;
    setStep(flow.mode === "new" ? "app" : flow.mode === "edit" ? "access" : "connect");
    setApp(c?.app ?? "claude-desktop");
    setName(c?.name ?? APPS["claude-desktop"].name);
    setNamed(!!c);
    setScope(c?.scope ?? "all");
    setPageIds(c?.pageIds ?? []);
    setPermission(c?.permission ?? "edit");
    setMade(flow.mode === "connect" ? { connection: flow.connection, url: flow.url } : null);
    setSetupApp(c?.app ?? "claude-desktop");
  }, [flow]);

  const chooseApp = (a: AppKind) => {
    setApp(a);
    setSetupApp(a);
    if (!named) setName(a === "other" ? "" : APPS[a].name);
  };

  const save = async () => {
    setBusy(true);
    try {
      const input: AIAppInput = { name: name.trim() || APPS[app].name, app, scope, pageIds, permission };
      if (editing) {
        onSaved((await aiApps.update(editing.id, input)).connection);
        return;
      }
      const r = await aiApps.create(input);
      onSaved(r.connection, r.url);
      setMade(r);
      setStep("connect");
    } catch (e) {
      toast(errText(e), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const shown = made?.connection;
  const title = step === "app" ? "Which AI app?" : step === "access" ? (editing ? `Edit ${editing.name}` : "What can it reach?") : `Connect ${shown?.name ?? ""}`;
  const footer =
    step === "app" ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => setStep("access")}>
          Next
        </Button>
      </>
    ) : step === "access" ? (
      <>
        {editing ? (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" icon="chevronLeft" onClick={() => setStep("app")}>
            Back
          </Button>
        )}
        <Button variant="primary" onClick={save} disabled={busy || (scope === "pages" && !pageIds.length)}>
          {busy ? <Spinner /> : editing ? "Save" : "Create connection"}
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    );

  return (
    <Dialog open={!!flow} onOpenChange={(o) => !o && onClose()} title={title} size="md" footer={footer}>
      {!editing && flow?.mode !== "connect" && <Stepper at={step} />}

      {step === "app" && (
        <div className="flex flex-col gap-5">
          <ChoiceCards<AppKind>
            label="Which AI app"
            value={app}
            onChange={chooseApp}
            stackOnPhone={false}
            options={APP_IDS.map((a) => ({ value: a, title: APPS[a].name, hint: APPS[a].hint, icon: <AppTile app={a} size="sm" /> }))}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Name</span>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNamed(true);
              }}
              placeholder={APPS[app].name === "Other app" ? "Cursor" : APPS[app].name}
              maxLength={60}
            />
            <span className="text-xs text-ink-3">So you can tell your connections apart, e.g. "Claude on my laptop".</span>
          </label>
        </div>
      )}

      {step === "access" && (
        <div className="flex flex-col gap-5">
          {editing && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={APPS[app].name} maxLength={60} />
            </label>
          )}
          <section className="flex flex-col gap-2" aria-label="It can reach">
            <h3 className="m-0 text-sm font-semibold text-ink">It can reach</h3>
            <ChoiceCards<"all" | "pages">
              label="It can reach"
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", title: "All pages", hint: "Everything in your space", icon: <Icon name="viewGrid" size={16} className="text-accent" /> },
                { value: "pages", title: "Chosen pages", hint: "Only the pages you pick, and what's inside them", icon: <Icon name="page" size={16} className="text-accent" /> },
              ]}
            />
            {scope === "pages" && <PageChooser value={pageIds} onChange={setPageIds} />}
          </section>
          <section className="flex flex-col gap-2" aria-label="It can">
            <h3 className="m-0 text-sm font-semibold text-ink">It can</h3>
            <ChoiceCards<"view" | "edit">
              label="It can"
              value={permission}
              onChange={setPermission}
              options={[
                { value: "view", title: "View", hint: "Search and read. It never changes anything.", icon: <Icon name="eye" size={16} className="text-accent" /> },
                { value: "edit", title: "View and edit", hint: "Also write, tick to-dos, move and trash pages", icon: <Icon name="pencil" size={16} className="text-accent" /> },
              ]}
            />
          </section>
        </div>
      )}

      {step === "connect" && made && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2" aria-label="Its private address">
            <h3 className="m-0 text-sm font-semibold text-ink">Its private address</h3>
            <AddressField url={made.url} />
            <p className="m-0 text-xs leading-relaxed text-ink-3">
              Shown only this once, so copy it now. Anyone with it can {made.connection.permission === "edit" ? "read and change" : "read"} {made.connection.scope === "all" ? "all your pages" : "the chosen pages"}. Lost it? Make a new one from the connection's menu.
            </p>
          </section>
          <section className="flex flex-col gap-3" aria-label="Add it to your AI app">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-semibold text-ink">Add it to {APPS[setupApp].name === "Other app" ? "your app" : APPS[setupApp].name}</h3>
              <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
                <Segmented<AppKind>
                  label="Show the steps for"
                  value={setupApp}
                  onValueChange={setSetupApp}
                  options={APP_IDS.map((a) => ({ value: a, label: a === "other" ? "Other" : APPS[a].name }))}
                  className="[&>*]:whitespace-nowrap"
                />
              </div>
            </div>
            <SetupSteps app={setupApp} url={made.url} />
          </section>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

function Meta({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icon name={icon} size={12} className="flex-none text-ink-4" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function ConnectionRow({ c, pages, onChange, onEdit, onRotate, onDelete }: { c: AIAppConnection; pages: Record<string, Page>; onChange: (c: AIAppConnection) => void; onEdit: () => void; onRotate: () => void; onDelete: () => void }) {
  const [busy, setBusy] = useState(false);
  const reach = c.scope === "all" ? "All pages" : c.pageIds.length === 1 ? (pages[c.pageIds[0]] ? displayTitle(pages[c.pageIds[0]]) : "1 page") : `${c.pageIds.length} pages`;
  const flip = async (enabled: boolean) => {
    setBusy(true);
    try {
      onChange((await aiApps.update(c.id, { enabled })).connection);
    } catch (e) {
      toast(errText(e), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className={cn(!c.enabled && "opacity-50 grayscale")}>
        <AppTile app={c.app ?? "other"} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate text-base font-semibold", c.enabled ? "text-ink" : "text-ink-3")}>{c.name}</span>
          {!c.enabled && <span className="flex-none rounded-full bg-well px-2 py-px text-[11px] font-semibold text-ink-3 shadow-[inset_0_0_0_1px_var(--d-line)]">Off</span>}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
          <Meta icon={c.scope === "all" ? "viewGrid" : "page"}>{reach}</Meta>
          <Meta icon={c.permission === "edit" ? "pencil" : "eye"}>{c.permission === "edit" ? "Can view and edit" : "View only"}</Meta>
          <Meta icon="clock">{c.lastUsedAt ? `Used ${timeAgo(c.lastUsedAt)}${c.lastTool && TOOL_WORDS[c.lastTool] ? `, ${TOOL_WORDS[c.lastTool]}` : ""}` : "Not used yet"}</Meta>
        </span>
      </div>
      <Switch label={`${c.name} on or off`} checked={c.enabled} disabled={busy} onCheckedChange={flip} />
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton icon="more" label={`More for ${c.name}`} size="sm" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon="pencil" onSelect={onEdit}>
            Edit access
          </MenuItem>
          <MenuItem icon="sync" onSelect={onRotate}>
            Make a new address
          </MenuItem>
          <MenuItem icon="trash" danger onSelect={onDelete}>
            Delete
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </li>
  );
}

const HOW = [
  { icon: "plus" as IconName, title: "Make a connection", text: "Pick the app, and what it can reach and do." },
  { icon: "copy" as IconName, title: "Add it to your app", text: "Paste its private address or the setup shown." },
  { icon: "sparkles" as IconName, title: "Ask about your pages", text: "“Turn my trip notes into a checklist.”" },
];

const CAN = [
  { icon: "search" as IconName, text: "Search pages and to-dos" },
  { icon: "eye" as IconName, text: "Read pages as Markdown" },
  { icon: "pagePlus" as IconName, text: "Make pages, inside others too" },
  { icon: "pencil" as IconName, text: "Add, rewrite and move parts" },
  { icon: "checkbox" as IconName, text: "Tick off to-dos" },
  { icon: "trash" as IconName, text: "Move pages to the trash, and back" },
];

export function AIApps() {
  const status = useAuth((a) => a.status);
  const pages = useStore((s) => s.pages);
  const [list, setList] = useState<AIAppConnection[] | null>(null);
  const [limit, setLimit] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [deleting, setDeleting] = useState<AIAppConnection | null>(null);

  // Load the list, and keep "Used …" fresh while this screen is open (an AI app may be working).
  useEffect(() => {
    if (status !== "signed-in") return;
    let live = true;
    const load = () =>
      aiApps.list().then(
        (r) => {
          if (!live) return;
          setList(r.connections);
          setLimit(r.limit);
          setError(null);
        },
        (e) => live && setError(errText(e)),
      );
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), 15_000);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [status]);

  const upsert = (c: AIAppConnection) => setList((l) => (l?.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [...(l ?? []), c]));

  if (status !== "signed-in")
    return (
      <Group title="Connect AI apps" description="Let Claude, Codex or another AI app search, read and write your pages.">
        <div className="flex items-start gap-3 rounded-lg bg-well p-4">
          <AppTile app="other" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-base font-semibold text-ink">Sign in to connect AI apps</p>
            <p className="m-0 mt-0.5 text-sm text-ink-3">AI apps reach your pages through your account, so they work wherever your pages are saved.</p>
          </div>
          <Button variant="primary" onClick={() => ui.set({ settings: "account" })}>
            Sign in
          </Button>
        </div>
      </Group>
    );

  const full = !!list && list.length >= limit;

  return (
    <div className="flex flex-col gap-6">
      <Group title="Connect AI apps" description="Let Claude, Codex or another AI app search, read and write your pages. Your own AI app does the thinking, so nothing is used up in Dovli. It works through MCP (Model Context Protocol), the open standard these apps share.">
        {error && <p className="m-0 rounded-lg bg-danger-soft px-4 py-3 text-sm text-ink">{error}</p>}
        {!list && !error && (
          <div className="grid h-24 place-items-center rounded-lg bg-well">
            <Spinner label="Loading connections" />
          </div>
        )}

        {list && !list.length && (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-well px-6 py-8 text-center">
            <div className="flex items-center gap-2" aria-hidden="true">
              {APP_IDS.map((a) => (
                <AppTile key={a} app={a} size="lg" />
              ))}
            </div>
            <div>
              <p className="m-0 text-md font-semibold text-ink">No AI apps connected yet</p>
              <p className="m-0 mx-auto mt-1 max-w-sm text-sm text-ink-3">Works with Claude Desktop, Claude Code, Codex and other apps that support MCP. Setting one up takes about a minute.</p>
            </div>
            <Button variant="primary" icon="plus" onClick={() => setFlow({ mode: "new" })}>
              New connection
            </Button>
          </div>
        )}

        {list && list.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-well shadow-[inset_0_0_0_1px_var(--d-line)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <span className="whitespace-nowrap text-xs font-medium text-ink-3">
                <span className="max-[480px]:hidden">Your connections · </span>
                {list.length} of {limit}
              </span>
              <Button size="sm" variant="primary" icon="plus" onClick={() => setFlow({ mode: "new" })} disabled={full}>
                New connection
              </Button>
            </div>
            <ul aria-label="Your connections" className="m-0 list-none divide-y divide-line p-0">
              {list.map((c) => (
                <ConnectionRow
                  key={c.id}
                  c={c}
                  pages={pages}
                  onChange={upsert}
                  onEdit={() => setFlow({ mode: "edit", connection: c })}
                  onRotate={async () => {
                    try {
                      const r = await aiApps.rotate(c.id);
                      upsert(r.connection);
                      setFlow({ mode: "connect", connection: r.connection, url: r.url });
                    } catch (e) {
                      toast(errText(e), { tone: "danger" });
                    }
                  }}
                  onDelete={() => setDeleting(c)}
                />
              ))}
            </ul>
          </div>
        )}
      </Group>

      <Group title="How it works">
        <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 max-[640px]:grid-cols-1">
          {HOW.map((h, i) => (
            <li key={h.title} className="flex flex-col gap-2 rounded-lg bg-well p-3.5">
              <span className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-ink">{h.title}</span>
              </span>
              <span className="text-xs leading-relaxed text-ink-3">{h.text}</span>
            </li>
          ))}
        </ol>
      </Group>

      <Group title="What AI apps can do" description="Most AI apps ask you before each change. A view-only connection never changes anything, and you can switch any connection off at once.">
        <ul className="m-0 grid list-none grid-cols-3 gap-x-4 gap-y-2.5 p-0 text-sm text-ink-2 max-[720px]:grid-cols-2 max-[480px]:grid-cols-1">
          {CAN.map((x) => (
            <li key={x.text} className="flex items-center gap-2">
              <Icon name={x.icon} size={15} className="flex-none text-accent" />
              {x.text}
            </li>
          ))}
        </ul>
      </Group>

      <ConnectionFlow
        flow={flow}
        onClose={() => setFlow(null)}
        onSaved={(c, url) => {
          upsert(c);
          if (!url) {
            setFlow(null);
            toast("Saved");
          }
        }}
      />
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "connection"}?`}
        description="The AI app loses access at once. Your pages aren't touched."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const c = deleting!;
                setDeleting(null);
                try {
                  await aiApps.remove(c.id);
                  setList((l) => (l ?? []).filter((x) => x.id !== c.id));
                  toast(`Deleted ${c.name}`);
                } catch (e) {
                  toast(errText(e), { tone: "danger" });
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
