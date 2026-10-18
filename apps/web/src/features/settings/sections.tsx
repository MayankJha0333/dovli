import { useEffect, useRef, useState, type ReactNode } from "react";
import { timeAgo } from "@dovli/core";
import { APP_THEMES, getTheme, SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME, type ThemePreference } from "@dovli/theme";
import { Button, Field, Icon, Input, Kbd, Pill, RadioCard, RadioCards, Segmented, Spinner, Switch, cn, modKey, toast } from "@dovli/ui";
import { refreshUsage, useAIUsage } from "@/lib/ai";
import { auth, useAuth } from "@/lib/auth";
import { backupFile, createBackup, listBackups, parseBackupFile, restoreBackup } from "@/lib/backups";
import { clearDevice, deleteUnowned, moveUnownedIntoAccount, perAccountStorage, unownedPageCount, type Backup } from "@/lib/db";
import { storageUsed } from "@/lib/files";
import { settings, useSettings, type TextSize } from "@/lib/settings";
import { store } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { sync, useSyncStatus } from "@/lib/sync";
import { download, exportWorkspace, importFiles } from "@/lib/transfer";
import { ui } from "@/lib/ui";
import { SignInPanel } from "@/features/auth/SignInDialog";
import { SHORTCUTS } from "@/features/workspace/useShortcuts";
import { ThemePreview } from "./ThemePreview";

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

export function Group({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line pb-6 last:border-b-0 last:pb-0">
      <div>
        <h3 className="m-0 text-md font-bold text-ink">{title}</h3>
        {description && <p className="m-0 mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="m-0 text-base font-medium text-ink">{label}</p>
        {hint && <p className="m-0 text-sm text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

export function Appearance() {
  const s = useSettings((x) => x);
  return (
    <div className="flex flex-col gap-6">
      <Group title="Theme" description="Changes the look of the whole app. Page styles still dress single pages.">
        <RadioCards<ThemePreference> value={s.theme} onValueChange={(v) => settings.set({ theme: v })} label="Theme" className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-2">
          {APP_THEMES.map((t) => (
            <RadioCard key={t.id} value={t.id}>
              <ThemePreview theme={t} />
              <span className="flex flex-col px-1 pb-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {t.name}
                  {t.id === "soft-studio" && <Pill className="h-5 px-2 text-2xs">Default</Pill>}
                </span>
                <span className="text-xs text-ink-3">{t.description}</span>
              </span>
            </RadioCard>
          ))}
          <RadioCard value="system">
            <div className="relative grid aspect-[16/10] grid-cols-2 overflow-hidden rounded-md">
              <ThemePreview theme={getTheme(SYSTEM_LIGHT_THEME)} className="aspect-auto h-full rounded-none [clip-path:inset(0_0_0_0)]" />
              <ThemePreview theme={getTheme(SYSTEM_DARK_THEME)} className="aspect-auto h-full rounded-none" />
            </div>
            <span className="flex flex-col px-1 pb-1">
              <span className="text-sm font-semibold text-ink">Match device</span>
              <span className="text-xs text-ink-3">Soft Studio by day, Night Desk at night</span>
            </span>
          </RadioCard>
        </RadioCards>
      </Group>

      <Group title="Reading and writing">
        <Row label="Text size" hint="Also follows your browser's text size.">
          <Segmented<TextSize>
            label="Text size"
            value={s.textSize}
            onValueChange={(v) => settings.set({ textSize: v })}
            options={[
              { value: "small", label: "Small" },
              { value: "default", label: "Default" },
              { value: "large", label: "Large" },
              { value: "larger", label: "Larger" },
            ]}
          />
        </Row>
        <Row label="Spell check" hint="Underline misspelled words while you write.">
          <Switch label="Spell check" checked={s.spellcheck} onCheckedChange={(v) => settings.set({ spellcheck: v })} />
        </Row>
        <Row label="Show the sidebar" hint={`Hide it for more room to write. Toggle with ${modKey()}\\.`}>
          <Switch label="Show the sidebar" checked={!s.sidebarHidden} onCheckedChange={(v) => settings.set({ sidebarHidden: !v })} />
        </Row>
        <Row label="Reduce motion" hint="Turn off sliding and fading. Dovli also follows your device setting.">
          <Switch label="Reduce motion" checked={s.reduceMotion} onCheckedChange={(v) => settings.set({ reduceMotion: v })} />
        </Row>
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export function Account() {
  const a = useAuth((x) => x);
  if (a.status !== "signed-in" || !a.account)
    return (
      <Group title="Sign in" description="Optional. Dovli works fully without an account.">
        {a.status === "loading" ? <Spinner /> : <SignInPanel />}
      </Group>
    );
  const acc = a.account;
  return (
    <div className="flex flex-col gap-6">
      <Group title="Account">
        <div className="flex items-center gap-3">
          {acc.avatar ? (
            <img src={acc.avatar} alt="" className="size-11 rounded-full" />
          ) : (
            <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-lg font-bold text-accent">{(acc.name ?? acc.email ?? "?").slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate font-semibold text-ink">{acc.name ?? acc.email}</p>
            <p className="m-0 truncate text-sm text-ink-3">
              {acc.email}
              {acc.provider === "google" ? " · signed in with Google" : " · signed in with an email code"}
            </p>
          </div>
          <Button icon="logout" onClick={() => void auth.signOut().then(() => toast("Signed out. Your pages stay on this device."))}>
            Sign out
          </Button>
        </div>
      </Group>
      <OlderPages />
      <Group title="Sync between devices">
        <p className="m-0 rounded-lg bg-well p-4 text-sm text-ink-2">
          Your pages are kept on this device, separate from anyone else who signs in here. Syncing them between your devices is the next step.
        </p>
      </Group>
    </div>
  );
}

/** Pages saved on this device before accounts existed: they belong to nobody until someone takes them. */
function OlderPages() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (perAccountStorage()) void unownedPageCount().then(setCount, () => setCount(0));
  }, []);
  if (!count) return null;
  const pages = `${count} ${count === 1 ? "page" : "pages"}`;
  return (
    <Group
      title="Pages from before you had an account"
      description={`This device has ${pages} saved before accounts were turned on. They aren't in any account, so nobody sees them yet.`}
    >
      {confirmDelete ? (
        <div role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft p-4">
          <p className="m-0 flex-1 text-sm font-medium text-danger">Delete these {pages} for good?</p>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await deleteUnowned();
                setCount(0);
                toast("Deleted the older pages");
              } catch (e) {
                toast(errText(e), { tone: "danger" });
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon="move"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await moveUnownedIntoAccount();
                location.reload(); // open the workspace again with the moved pages in it
              } catch (e) {
                toast(errText(e), { tone: "danger" });
                setBusy(false);
              }
            }}
          >
            {busy ? "Moving…" : "Move them into my account"}
          </Button>
          <Button variant="dangerGhost" disabled={busy} onClick={() => setConfirmDelete(true)}>
            Delete them
          </Button>
        </div>
      )}
    </Group>
  );
}

/* ------------------------------------------------------------------ */
/* Sync and backups                                                    */
/* ------------------------------------------------------------------ */

const STATE_TEXT: Record<string, string> = {
  "local-only": "Saved on this device. Syncing between devices is coming soon.",
  "signed-out": "Saved on this device. Sign in to sync with your other devices.",
  offline: "You're offline. Changes are saved here and will sync when you're back.",
  syncing: "Syncing your changes…",
  synced: "Everything is synced.",
  error: "Sync hit a problem and will try again shortly.",
};

export function SyncBackups() {
  const status = useSyncStatus();
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [usage, setUsage] = useState<{ files: number; bytes: number } | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);
  const load = () => void listBackups().then(setBackups);
  useEffect(() => {
    load();
    void storageUsed().then(setUsage);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Group title="Sync">
        <div className="flex items-start gap-3 rounded-lg bg-well p-4">
          <Icon name={status.state === "synced" ? "cloudCheck" : status.state === "offline" ? "cloudOff" : status.state === "syncing" ? "sync" : "device"} size={20} className="mt-0.5 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-base font-medium text-ink">{STATE_TEXT[status.state]}</p>
            <p className="m-0 mt-0.5 text-sm text-ink-3">
              {status.lastSyncedAt ? `Last synced ${timeAgo(status.lastSyncedAt)}. ` : ""}
              {status.pending ? `${status.pending} change${status.pending > 1 ? "s" : ""} waiting to sync.` : ""}
              {status.error ? ` (${status.error})` : ""}
            </p>
          </div>
          {status.state === "signed-out" && (
            <Button variant="primary" onClick={() => ui.set({ settings: "account" })}>
              Sign in
            </Button>
          )}
          {["synced", "error", "offline", "syncing"].includes(status.state) && (
            <Button icon="sync" onClick={() => sync.now()}>
              Sync now
            </Button>
          )}
        </div>
        <p className="m-0 text-sm text-ink-3">
          Dovli saves every change on this device first, so it works with no internet. When you edit the same page on two devices while offline, both sets of changes are kept.
        </p>
      </Group>

      <Group title="Backups" description="A copy of every page is kept on this device once a day. The last 7 are kept.">
        <div className="flex flex-wrap gap-2">
          <Button
            icon="history"
            onClick={async () => {
              await createBackup();
              toast("Backup made");
              load();
            }}
          >
            Back up now
          </Button>
          <Button icon="download" onClick={() => download(backupFile(), `Dovli backup ${new Date().toLocaleDateString("en-CA")}.json`)}>
            Download a backup file
          </Button>
          <Button icon="upload" variant="ghost" onClick={() => restoreInput.current?.click()}>
            Restore from a file
          </Button>
          <input
            ref={restoreInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const pages = parseBackupFile(await f.text());
                await createBackup();
                store.replaceAll(pages);
                toast("Backup restored. Pages that weren't in it are in the trash.");
              } catch (err) {
                toast(errText(err), { tone: "danger" });
              }
              e.target.value = "";
            }}
          />
        </div>
        {backups === null ? (
          <Spinner />
        ) : backups.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {backups.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-hover">
                <Icon name="history" size={15} className="text-ink-3" />
                <span className="flex-1 text-sm text-ink-2">
                  {new Date(b.createdAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  <span className="text-ink-4"> · {b.pageCount} pages</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => download(backupFile(b.pages), `Dovli backup ${new Date(b.createdAt).toLocaleDateString("en-CA")}.json`)}>
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await restoreBackup(b.id);
                    toast("Backup restored. Pages that weren't in it are in the trash.");
                    load();
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-ink-3">No backups yet.</p>
        )}
        {usage && (
          <p className="m-0 text-xs text-ink-4">
            Files on this device: {usage.files} ({(usage.bytes / 1048576).toFixed(1)} MB)
          </p>
        )}
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Import and export                                                   */
/* ------------------------------------------------------------------ */

export function Data() {
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);

  const run = async (list: File[]) => {
    if (!list.length) return;
    setBusy("Reading files");
    try {
      const r = await importFiles(list, setBusy);
      toast(r.kind === "backup" ? `Restored ${r.pages} pages from the backup` : `Imported ${r.pages} page${r.pages === 1 ? "" : "s"}${r.files ? ` and ${r.files} file${r.files === 1 ? "" : "s"}` : ""}`, {
        action: r.rootId ? { label: "Open", onClick: () => store.navigate({ name: "page", id: r.rootId! }) } : undefined,
      });
      if (r.rootId) {
        ui.set({ settings: null });
        store.navigate({ name: "page", id: r.rootId });
      }
    } catch (err) {
      toast(errText(err), { tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Group title="Import" description="Bring pages in from Notion, Obsidian or any Markdown files. Pictures come along.">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void run([...e.dataTransfer.files]);
          }}
          className={cn("flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-line-strong")}
        >
          {busy ? (
            <>
              <Spinner />
              <p className="m-0 text-sm text-ink-2">{busy}</p>
            </>
          ) : (
            <>
              <Icon name="importIcon" size={24} className="text-ink-3" />
              <p className="m-0 text-base font-medium text-ink">Drop files here</p>
              <p className="m-0 max-w-[48ch] text-sm text-ink-3">
                A Notion export (.zip, choose “Markdown & CSV”), Markdown files (.md), CSV tables (.csv), a folder of them, or a Dovli backup (.json).
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon="upload" onClick={() => files.current?.click()}>
                  Choose files
                </Button>
                <Button icon="move" onClick={() => folder.current?.click()}>
                  Choose a folder
                </Button>
              </div>
            </>
          )}
          <input ref={files} type="file" multiple accept=".md,.markdown,.txt,.zip,.json,.csv" className="sr-only" onChange={(e) => void run([...(e.target.files ?? [])]).then(() => (e.target.value = ""))} />
          <input
            ref={folder}
            type="file"
            multiple
            className="sr-only"
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => void run([...(e.target.files ?? [])]).then(() => (e.target.value = ""))}
          />
        </div>
      </Group>
      <Group title="Export" description="Your pages are yours. Take them anywhere, any time.">
        <Row label="Everything" hint="A ZIP with every page as Markdown and as a web page, your pictures and files, and a full backup.">
          <Button
            icon="download"
            disabled={!!busy}
            onClick={async () => {
              setBusy("Exporting");
              try {
                await exportWorkspace((d, t) => setBusy(`Exporting ${d} of ${t}`));
              } catch (err) {
                toast(errText(err), { tone: "danger" });
              } finally {
                setBusy(null);
              }
            }}
          >
            Export all
          </Button>
        </Row>
        <p className="m-0 text-sm text-ink-3">To export one page as Markdown, a web page or PDF, open the page, then Info (the ⓘ button) → Actions.</p>
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

export function AI() {
  const u = useAIUsage();
  const a = useAuth((x) => x.status);
  useEffect(() => {
    void refreshUsage();
  }, [a]);
  const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  const resets = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return (
    <div className="flex flex-col gap-6">
      <Group title="Writing help" description="Select text in a page and choose Ask AI to rewrite, shorten, fix, change the tone or translate it. For a summary or a review of a whole page, use the Assistant button at the bottom right of the page.">
        {!u.available ? (
          <div className="rounded-lg bg-well p-4 text-sm text-ink-2">
            {cloudConfigured && a !== "signed-in" ? (
              <>
                <p className="m-0 font-semibold text-ink">Sign in to use AI</p>
                <p className="m-0 mt-1">AI is included with every account, with a monthly allowance.</p>
                <Button variant="primary" className="mt-3" onClick={() => ui.set({ settings: "account" })}>
                  Sign in
                </Button>
              </>
            ) : (
              <>
                <p className="m-0 font-semibold text-ink">AI isn't set up on this copy of Dovli</p>
                <p className="m-0 mt-1">
                  Add <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to the server settings and restart. The README explains how.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg bg-well p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold text-ink">This month</span>
              <span className="text-sm tabular-nums text-ink-2">
                {pct}% used{u.source === "device" ? " on this device" : ""}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="AI allowance used">
              <div className={cn("h-full rounded-full transition-[width]", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
            </div>
            <p className="m-0 text-sm text-ink-3">
              {Math.max(0, u.limit - u.used).toLocaleString()} of {u.limit.toLocaleString()} tokens left (a token is about ¾ of a word). Resets on {resets}.
            </p>
          </div>
        )}
      </Group>
      <Group title="Your notes and AI">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-ink-2">
          <li className="flex gap-2">
            <Icon name="check" size={15} className="mt-0.5 flex-none text-ok" />
            Dovli never uses your notes to train AI.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={15} className="mt-0.5 flex-none text-ok" />
            Only the text you select (or the page you summarise) is sent, and only when you ask.
          </li>
        </ul>
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy                                                             */
/* ------------------------------------------------------------------ */

export function Privacy() {
  const a = useAuth((x) => x);
  const [confirm, setConfirm] = useState<"device" | "account" | null>(null);
  const [busy, setBusy] = useState(false);
  const promises = [
    "Your pages are saved on this device first, and work without internet.",
    "Signing in uses Firebase Authentication (Google). Dovli never sees a password: you sign in with Google or a one-time email code.",
    "Only you can read your pages. Share links show one page, only to people with the link, and you can turn them off any time.",
    "Dovli never uses your notes to train AI, and never sells your data.",
    "You can export everything, or delete everything, at any time.",
  ];
  return (
    <div className="flex flex-col gap-6">
      <Group title="Our promises">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-ink-2">
          {promises.map((p) => (
            <li key={p} className="flex gap-2">
              <Icon name="shield" size={15} className="mt-0.5 flex-none text-ok" />
              {p}
            </li>
          ))}
        </ul>
      </Group>
      <Group title="Delete data">
        <Row
          label={a.status === "signed-in" ? "Delete my pages on this device" : "Delete everything on this device"}
          hint={a.status === "signed-in" ? "Your pages, files and backups here. Your account stays, and other accounts on this device aren't touched." : "Pages, files and backups here are removed for good."}
        >
          <Button variant="dangerGhost" onClick={() => setConfirm("device")}>
            Delete
          </Button>
        </Row>
        {a.status === "signed-in" && (
          <Row label="Delete my account" hint="Removes your Dovli account and its pages on this device, for good.">
            <Button variant="dangerGhost" onClick={() => setConfirm("account")}>
              Delete account
            </Button>
          </Row>
        )}
        {confirm && (
          <div role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft p-4">
            <p className="m-0 flex-1 text-sm font-medium text-danger">
              {confirm === "device"
                ? a.status === "signed-in"
                  ? "Delete your pages, files and backups on this device?"
                  : "Delete all pages, files and backups on this device?"
                : "Delete your Dovli account and its pages here? This can't be undone."}
            </p>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (confirm === "account") {
                    const token = await auth.accessToken();
                    const res = await fetch("/api/account/delete", { method: "POST", headers: { authorization: `Bearer ${token}` } });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error ?? "Couldn't delete the account.");
                    await auth.signOut({ leave: false });
                  }
                  await clearDevice();
                  try {
                    localStorage.clear();
                  } catch {
                    /* ignore */
                  }
                  location.replace("/");
                } catch (err) {
                  toast(errText(err), { tone: "danger" });
                  setBusy(false);
                }
              }}
            >
              {busy ? "Deleting" : "Delete for good"}
            </Button>
          </div>
        )}
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shortcuts                                                           */
/* ------------------------------------------------------------------ */

export function Shortcuts() {
  const mod = modKey();
  return (
    <Group title="Keyboard shortcuts" description="Everything in Dovli also works with the keyboard alone: Tab moves between controls, Enter opens, Esc closes.">
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="contents">
            <dt className="text-sm text-ink-2">{s.label}</dt>
            <dd className="m-0 flex justify-end gap-1">
              {s.keys
                .replace("⌘", mod.replace("+", ""))
                .split(" + ")
                .map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
            </dd>
          </div>
        ))}
      </dl>
    </Group>
  );
}
