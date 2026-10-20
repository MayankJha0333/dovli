import "@/lib/editorBridge";
import { useEffect } from "react";
import { displayTitle } from "@dovli/core";
import { Spinner, Toaster, TooltipProvider, cn } from "@dovli/ui";
import { autoBackup } from "@/lib/backups";
import { applySettings, useSettings } from "@/lib/settings";
import { initStore, routeFromHash, store, useStore } from "@/lib/store";
import { startSync } from "@/lib/sync";
import { refreshUsage } from "@/lib/ai";
import { ui, useUI } from "@/lib/ui";
import { auth, initAuth, useAuth } from "@/lib/auth";
import { authGateOn } from "@/lib/authGate";
import { AssistantButton } from "@/features/ai/AssistantButton";
import { AssistantPanel } from "@/features/assistant/AssistantPanel";
import { SignInDialog } from "@/features/auth/SignInDialog";
import { ConnectExtensionDialog, takeConnectRequest } from "@/features/extension/ConnectExtension";
import { Home } from "@/features/home/Home";
import { LinkNotesDialog } from "@/features/link-notes/LinkNotesDialog";
import { PageView } from "@/features/page/PageView";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { PagePicker } from "@/features/pages/PagePicker";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { ShareDialog } from "@/features/share/ShareDialog";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { startSidebarFollow } from "@/features/sidebar/follow";
import { StyleGallery } from "@/features/page-styles/StyleGallery";
import { TagView } from "@/features/tags/TagView";
import { TemplatesView } from "@/features/templates/TemplatesView";
import { TrashView } from "@/features/trash/TrashView";
import { useShortcuts } from "./useShortcuts";

/** Soft colour behind glass themes. Themes without glows draw nothing. */
function Glows() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" data-print="hide">
      <div className="absolute -left-[200px] -top-[240px] h-[600px] w-[720px] rounded-full bg-[var(--d-glow-1)] opacity-[var(--d-glow-1-o)] blur-[120px]" />
      <div className="absolute -right-[180px] bottom-[8%] h-[520px] w-[600px] rounded-full bg-[var(--d-glow-2)] opacity-[var(--d-glow-2-o)] blur-[130px]" />
      <div className="absolute -bottom-[220px] left-[34%] h-[420px] w-[620px] rounded-full bg-[var(--d-glow-3)] opacity-[var(--d-glow-3-o)] blur-[130px]" />
    </div>
  );
}

export default function Workspace({ accountId }: { accountId?: string }) {
  const ready = useStore((s) => s.ready);
  const route = useStore((s) => s.route);
  const nav = useUI((s) => s.nav);
  const sidebarHidden = useSettings((s) => s.sidebarHidden);
  const assistantOpen = useUI((s) => s.assistant);

  useEffect(() => {
    applySettings();
    void initStore().then(() => void autoBackup());
    initAuth();
    startSync();
    takeConnectRequest();
  }, []);

  // Back/forward buttons and links like #p-abc123 inside pages.
  useEffect(() => {
    const onHash = () => store.navigate(routeFromHash(store.get().pages), { replace: true });
    window.addEventListener("popstate", onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onHash);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  useEffect(() => ui.set({ nav: false }), [route]);

  // Signed out in another tab, or this browser's sign-in was cleared: back to the sign-in page.
  // Or someone else signed in here meanwhile: this tab still shows the first account's pages, so
  // go through sign-in again and come back to the right account's workspace.
  const authStatus = useAuth((s) => s.status);
  const signedInAs = useAuth((s) => s.account?.id);
  useEffect(() => {
    if (!authGateOn) return;
    if (authStatus === "signed-out" || (authStatus === "signed-in" && accountId && signedInAs !== accountId)) void auth.leaveForSignIn();
  }, [authStatus, signedInAs, accountId]);

  // Ask which AI is ready only once sign-in has settled: asked earlier, the server sees no account
  // yet and answers "sign in first", which would stick until something asked again.
  useEffect(() => {
    if (authStatus !== "loading") void refreshUsage();
  }, [authStatus, signedInAs]);

  // The sidebar's two sides follow the route once the pages are loaded.
  useEffect(() => {
    if (ready) startSidebarFollow();
  }, [ready]);

  const title = useStore((s) => {
    const r = s.route;
    if (r.name === "page") return s.pages[r.id] ? displayTitle(s.pages[r.id]) : "Page";
    return r.name === "templates" ? "Templates" : r.name === "trash" ? "Trash" : r.name === "tag" ? `#${r.tag}` : "All pages";
  });
  useEffect(() => {
    document.title = `${title} · Dovli`;
  }, [title]);

  useShortcuts();

  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Spinner label="Opening your pages" />
      </div>
    );

  return (
    <TooltipProvider>
      <Glows />
      <div
        data-print="shell"
        className={cn(
          "grid h-dvh gap-[var(--d-shell-gap)] p-[var(--d-shell-gap)] max-[860px]:grid-cols-1 max-[860px]:gap-0 max-[860px]:p-0",
          sidebarHidden ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[272px_minmax(0,1fr)]",
          // The assistant takes a third column on wide screens; on narrower ones it floats over the page.
          assistantOpen && (sidebarHidden ? "min-[1181px]:grid-cols-[minmax(0,1fr)_360px]" : "min-[1181px]:grid-cols-[272px_minmax(0,1fr)_360px]"),
        )}
      >
        <div className={cn("contents", sidebarHidden && "min-[861px]:hidden")}>
          <Sidebar />
        </div>
        <div
          aria-hidden="true"
          onClick={() => ui.set({ nav: false })}
          className={cn(
            "fixed inset-0 z-40 bg-overlay transition-opacity min-[861px]:hidden",
            nav ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <main
          id="main"
          tabIndex={-1}
          className="relative min-h-0 min-w-0 overflow-hidden rounded-shell shadow-shell surface-panel focus:outline-none max-[860px]:rounded-none"
        >
          {route.name === "home" && <Home />}
          {route.name === "templates" && <TemplatesView />}
          {route.name === "trash" && <TrashView />}
          {route.name === "tag" && <TagView tag={route.tag} />}
          {route.name === "page" && <PageView key={route.id} id={route.id} />}
          <AssistantButton />
        </main>
        <AssistantPanel />
      </div>

      <CommandPalette />
      <SettingsDialog />
      <SignInDialog />
      <ShareDialog />
      <LinkNotesDialog />
      <ConnectExtensionDialog />
      <PagePicker />
      <StyleGallery />
      <Toaster />
    </TooltipProvider>
  );
}
