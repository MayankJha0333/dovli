import { useEffect, useState } from "react";
import { displayTitle } from "@dovli/core";
import { Button, Dialog, Icon, Input, Segmented, Spinner, Switch, toast } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { getShare, resetShare, setShare, shareUrl, type ShareLink } from "@/lib/share";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { ui, useUI } from "@/lib/ui";
import { SignInPanel } from "@/features/auth/SignInDialog";

/** Share one page with a private link: view only, or let people edit. */
export function ShareDialog() {
  const id = useUI((s) => s.share);
  const page = useStore((s) => (id ? s.pages[id] : undefined));
  const signedIn = useAuth((a) => a.status === "signed-in");
  const [link, setLink] = useState<ShareLink | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLink(undefined);
    if (!id || !signedIn) return;
    getShare(id)
      .then(setLink)
      .catch(() => setLink(null));
  }, [id, signedIn]);

  const change = async (patch: { enabled?: boolean; access?: "view" | "edit" }) => {
    if (!id) return;
    setBusy(true);
    try {
      setLink(await setShare(id, patch));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change sharing.", { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const url = link ? shareUrl(link.id) : "";
  const on = !!link?.enabled;

  return (
    <Dialog open={!!page} onOpenChange={(o) => !o && ui.set({ share: null })} title={page ? `Share “${displayTitle(page)}”` : "Share"} size="sm">
      {!cloudConfigured ? (
        <p className="m-0 text-sm text-ink-2">Sharing needs accounts, which aren't set up on this copy of Dovli. You can still export it: open Info (the ⓘ button) and choose Actions.</p>
      ) : !signedIn ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-ink-2">Sign in to share pages with a link.</p>
          <SignInPanel />
        </div>
      ) : link === undefined ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 font-medium text-ink">Share with a link</p>
              <p className="m-0 text-sm text-ink-3">Anyone with the link can open this page. Nothing else in your workspace.</p>
            </div>
            <Switch label="Share with a link" checked={on} disabled={busy} onCheckedChange={(v) => change({ enabled: v })} />
          </div>
          {on && link && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink-2">People with the link can</span>
                <Segmented<"view" | "edit">
                  label="Access"
                  value={link.access}
                  onValueChange={(v) => change({ access: v })}
                  options={[
                    { value: "view", label: "View", icon: "eye" },
                    { value: "edit", label: "Edit", icon: "pencil" },
                  ]}
                />
              </div>
              <div className="flex gap-1.5">
                <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
                <Button
                  variant="primary"
                  icon="copy"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url).catch(() => {});
                    toast("Link copied");
                  }}
                >
                  Copy
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-3">
                <Icon name="lock" size={13} />
                The link is long and random, so only people you send it to can find it.
                <button
                  type="button"
                  className="ml-auto whitespace-nowrap font-semibold text-accent hover:underline"
                  onClick={async () => {
                    if (!id) return;
                    setLink(await resetShare(id));
                    toast("New link made. The old one no longer works.");
                  }}
                >
                  Make a new link
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
