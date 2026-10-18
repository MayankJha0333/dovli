"use client";

import { useEffect, useState, type ReactNode } from "react";
import { displayTitle, type Page } from "@dovli/core";
import { Button, Dialog, Icon, Input, MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger, Segmented, Spinner, Switch, cn, toast, type IconName } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { linkUrl, share, sharingOn, type SharePerson, type ShareRole, type ShareSettings } from "@/lib/share";
import { store, useStore } from "@/lib/store";
import { exportPageDocx, exportPageHtml, exportPageImage, exportPageMarkdown, exportPagePdf } from "@/lib/transfer";
import { ui, useUI } from "@/lib/ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
const ROLE_TEXT: Record<ShareRole, string> = { viewer: "Can view", editor: "Can edit" };

/**
 * The Share window, like Craft's: invite people by email (can view / can edit), see who has
 * access, turn on an invitation link, and export the page (PDF, Word, Markdown, image, web page).
 */
export function ShareDialog() {
  const id = useUI((s) => s.share);
  const page = useStore((s) => (id ? s.pages[id] : undefined));
  const signedIn = useAuth((a) => a.status === "signed-in");
  const canShare = sharingOn && signedIn && page?.kind === "doc";
  const [tab, setTab] = useState<"share" | "export">("share");
  useEffect(() => setTab(canShare ? "share" : "export"), [id, canShare]);

  return (
    <Dialog open={!!page} onOpenChange={(o) => !o && ui.set({ share: null })} title={page ? `Share “${displayTitle(page)}”` : "Share"} size="md">
      {page && (
        <div className="flex flex-col gap-4">
          {canShare && (
            <Segmented<"share" | "export">
              label="Share or export"
              value={tab}
              onValueChange={setTab}
              className="self-start"
              options={[
                { value: "share", label: "Share", icon: "share" },
                { value: "export", label: "Export", icon: "download" },
              ]}
            />
          )}
          {tab === "share" && canShare ? <SharePanel page={page} /> : <ExportPanel page={page} note={!sharingOn ? "Sharing needs accounts, which aren't set up on this copy of Dovli." : page.kind === "board" ? "Whiteboards can't be shared yet. You can export them." : undefined} />}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Share                                                               */
/* ------------------------------------------------------------------ */

function SharePanel({ page }: { page: Page }) {
  const me = useAuth((a) => a.account);
  const [s, setS] = useState<ShareSettings | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [busy, setBusy] = useState<"" | "invite" | "link" | string>("");

  useEffect(() => {
    let live = true;
    setS(null);
    setError("");
    share.settings(page.id).then(
      (r) => live && setS(r),
      (e) => live && setError(errText(e)),
    );
    return () => {
      live = false;
    };
  }, [page.id]);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  }

  async function invite() {
    const to = email.trim().toLowerCase();
    const r = await run("invite", () => share.invite(page.id, to, role));
    if (!r) return;
    setEmail("");
    if (r.status === "member") toast(`${to} is already in this workspace.`);
    else if (!r.emailed) toast(`${r.name ?? to} can now open it. The email couldn't be sent, so send them the link yourself.`, { tone: "danger" });
    else toast(r.status === "added" ? `Shared with ${r.name ?? to}` : `Invite sent to ${to}`);
    setS(await share.settings(page.id).catch(() => s));
  }

  if (!s && !error)
    return (
      <div className="grid min-h-40 place-items-center">
        <Spinner label="Loading sharing" />
      </div>
    );

  const link = s?.link;
  const linkOn = !!link?.enabled;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <div className="flex flex-col gap-5">
      {/* Invite people */}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (validEmail && !busy) void invite();
        }}
      >
        <Input
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          aria-label="Email address to invite"
          placeholder="Add people by email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 basis-56"
        />
        <RoleMenu value={role} onChange={(r) => r && setRole(r)} label="Access for the people you invite" />
        <Button type="submit" variant="primary" disabled={!validEmail || !!busy}>
          {busy === "invite" ? "Inviting…" : "Invite"}
        </Button>
      </form>

      {/* People with access */}
      {s && (
        <section aria-labelledby="share-people" className="flex flex-col gap-1">
          <h3 id="share-people" className="m-0 mb-1 text-sm font-semibold text-ink-2">
            People with access
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {s.people.map((p) => (
              <PersonRow
                key={p.uid ?? p.email}
                person={p}
                you={!!me && p.uid === me.id}
                busy={busy === (p.uid ?? p.email)}
                onRole={async (r) => {
                  const next = await run(p.uid ?? p.email ?? "", () => share.setRole(page.id, p, r));
                  if (next) {
                    setS(next);
                    toast(r ? `${p.name ?? p.email} ${r === "editor" ? "can now edit" : "can now only view"}` : `Removed ${p.name ?? p.email}`);
                  }
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Invitation link */}
      {s && (
        <section aria-labelledby="share-link" className="flex flex-col gap-3 rounded-lg bg-well p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-md bg-accent-soft text-accent" aria-hidden="true">
              <Icon name="link" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="share-link" className="m-0 text-base font-semibold text-ink">
                Invitation link
              </h3>
              <p className="m-0 text-sm text-ink-3">
                {!linkOn ? "Off. Only the people above can open this page." : link!.role === "editor" ? "Anyone with the link can edit. Editing needs a Dovli account." : "Anyone with the link can view. No account needed."}
              </p>
            </div>
            <Switch
              label="Invitation link"
              checked={linkOn}
              disabled={busy === "link"}
              onCheckedChange={async (v) => {
                const l = await run("link", () => share.setLink(page.id, { enabled: v }));
                if (l) setS({ ...s, link: l });
              }}
            />
          </div>
          {linkOn && link && (
            <div className="flex flex-wrap items-center gap-2 pl-11">
              <RoleMenu
                value={link.role}
                label="What people with the link can do"
                onChange={async (r) => {
                  if (!r) return;
                  const l = await run("link", () => share.setLink(page.id, { role: r }));
                  if (l) setS({ ...s, link: l });
                }}
              />
              <Button
                icon="copy"
                onClick={async () => {
                  await navigator.clipboard?.writeText(linkUrl(link.id)).catch(() => {});
                  toast("Link copied");
                }}
              >
                Copy link
              </Button>
              <button
                type="button"
                className="ml-auto rounded-sm text-sm font-semibold text-accent hover:underline"
                onClick={async () => {
                  const l = await run("link", () => share.setLink(page.id, { reset: true }));
                  if (l) {
                    setS({ ...s, link: l });
                    toast("New link made. The old one no longer works.");
                  }
                }}
              >
                Make a new link
              </button>
            </div>
          )}
        </section>
      )}

      <p role="alert" aria-live="assertive" className="m-0 text-sm text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}

function PersonRow({ person: p, you, busy, onRole }: { person: SharePerson; you: boolean; busy: boolean; onRole: (r: ShareRole | null) => void }) {
  const name = p.name ?? p.email ?? "Someone";
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-md px-1 py-1.5">
      {p.photoURL ? (
        <img src={p.photoURL} alt="" className="size-8 flex-none rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className={cn("grid size-8 flex-none place-items-center rounded-full text-sm font-bold", p.pending ? "bg-well text-ink-3" : "bg-accent-soft text-accent")} aria-hidden="true">
          {p.pending ? <Icon name="mail" size={15} /> : name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-base font-medium text-ink">
          {name}
          {you && <span className="font-normal text-ink-3"> (you)</span>}
        </p>
        <p className="m-0 truncate text-sm text-ink-3">{p.pending ? "Invited · hasn't joined yet" : p.name ? p.email : ""}</p>
      </div>
      {p.role === "owner" ? (
        <span className="px-2 text-sm text-ink-3">Owner</span>
      ) : busy ? (
        <Spinner />
      ) : (
        <RoleMenu value={p.role} onChange={onRole} label={`Access for ${name}`} removable />
      )}
    </li>
  );
}

function RoleMenu({ value, onChange, label, removable }: { value: ShareRole; onChange: (r: ShareRole | null) => void; label: string; removable?: boolean }) {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="ghost" aria-label={`${label}: ${ROLE_TEXT[value]}`} className="gap-1 whitespace-nowrap">
          {ROLE_TEXT[value]}
          <Icon name="chevronDown" size={14} className="text-ink-3" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        {(["viewer", "editor"] as const).map((r) => (
          <MenuItem key={r} icon={r === value ? "check" : r === "viewer" ? "eye" : "pencil"} onSelect={() => r !== value && onChange(r)}>
            {ROLE_TEXT[r]}
          </MenuItem>
        ))}
        {removable && (
          <>
            <MenuSeparator />
            <MenuItem icon="close" danger onSelect={() => onChange(null)}>
              Remove access
            </MenuItem>
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function ExportPanel({ page, note }: { page: Page; note?: string }) {
  const [busy, setBusy] = useState("");
  const doc = page.kind === "doc";
  const open = () => {
    const r = store.get().route;
    if (r.name !== "page" || r.id !== page.id) store.navigate({ name: "page", id: page.id });
  };
  const formats: { id: string; icon: IconName; name: string; hint: string; run: () => Promise<void> | void; docOnly?: boolean }[] = [
    {
      id: "pdf",
      icon: "pdf",
      name: "PDF",
      hint: "For printing or sending. Choose “Save as PDF” in the print window.",
      run: () => {
        open();
        ui.set({ share: null });
        setTimeout(exportPagePdf, 400);
      },
    },
    { id: "docx", icon: "file", name: "Word (.docx)", hint: "Edit it in Word, Pages or Google Docs.", run: () => exportPageDocx(page), docOnly: true },
    { id: "md", icon: "code", name: "Markdown (.md)", hint: "Plain text with formatting marks. Pictures come in a ZIP.", run: () => exportPageMarkdown(page), docOnly: true },
    {
      id: "png",
      icon: "image",
      name: "Image (.png)",
      hint: "A picture of the page, just as it looks.",
      run: async () => {
        open();
        await new Promise((r) => setTimeout(r, 300));
        await exportPageImage(page);
      },
    },
    { id: "html", icon: "link", name: "Web page (.html)", hint: "One file that opens in any browser.", run: () => exportPageHtml(page), docOnly: true },
  ];
  return (
    <div className="flex flex-col gap-3">
      {note && <p className="m-0 rounded-lg bg-well p-3 text-sm text-ink-2">{note}</p>}
      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Export formats">
        {formats
          .filter((f) => doc || !f.docOnly)
          .map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(f.id);
                  try {
                    await f.run();
                  } catch (e) {
                    toast(errText(e), { tone: "danger" });
                  } finally {
                    setBusy("");
                  }
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-hover disabled:opacity-60"
              >
                <span className="grid size-9 flex-none place-items-center rounded-md bg-well text-ink-2" aria-hidden="true">
                  <Icon name={f.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium text-ink">{f.name}</span>
                  <span className="block text-sm text-ink-3">{f.hint}</span>
                </span>
                {busy === f.id ? <Spinner /> : <Icon name="download" size={16} className="text-ink-3" />}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

export type { ReactNode };
