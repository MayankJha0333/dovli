import { Suspense, lazy, useEffect, useRef } from "react";
import { DovliMark, Spinner } from "@dovli/ui";
import { initAuth, useAuth } from "@/lib/auth";
import { setAccountStorage } from "@/lib/db";
import { desktop } from "@/lib/desktop";
import { useDesktopCommands } from "./commands";
import { SignInScreen } from "./SignInScreen";
import { TitleBar } from "./TitleBar";

// The desktop window: the sign-in screen, or the workspace of whoever is signed in. Signing in
// works offline after the first time (Firebase keeps the sign-in on this computer), so the app
// always opens straight to your pages.

const Workspace = lazy(() => import("@/features/workspace/Workspace"));

/** The account whose storage this page opened. Storage opens once per page (lib/db.ts). */
let openedFor: string | null = null;

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <DovliMark size={52} />
        <Spinner label="Opening your pages" />
      </div>
    </div>
  );
}

function AccountWorkspace({ account }: { account: string | null }) {
  useDesktopCommands();
  return <Workspace accountId={account ?? undefined} />;
}

/** The window's colours, for its title bar and the next launch's first paint. */
function useThemeForWindow() {
  useEffect(() => {
    if (!desktop) return;
    let last = "";
    const report = () => {
      const style = getComputedStyle(document.body);
      const theme = { bg: style.backgroundColor, ink: style.color, dark: document.documentElement.dataset.scheme === "dark" };
      const key = JSON.stringify(theme);
      if (key === last) return;
      last = key;
      desktop!.setTheme(theme);
    };
    report();
    const watch = new MutationObserver(() => requestAnimationFrame(report));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme", "style"] });
    return () => watch.disconnect();
  }, []);
}

export function DesktopApp() {
  const status = useAuth((s) => s.status);
  const account = useAuth((s) => s.account?.id ?? null);
  const wasSignedIn = useRef(false);
  useThemeForWindow();

  useEffect(() => {
    initAuth();
    // In-app paths (/login after signing out) mean nothing here; the address is always the app.
    if (location.pathname !== "/") history.replaceState(null, "", `/${location.hash}`);
  }, []);

  // Signed out (here, or everywhere from another device): start this window afresh.
  useEffect(() => {
    if (status === "signed-in") wasSignedIn.current = true;
    else if (status === "signed-out" && wasSignedIn.current) location.replace("/");
  }, [status]);

  const workspace = status === "local-only" || status === "signed-in";
  let body = <Splash />;
  if (status === "signed-out") body = <SignInScreen />;
  else if (workspace) {
    if (openedFor !== null && openedFor !== account) {
      // A different account than this page opened: storage can't switch, so reload for theirs.
      location.replace("/");
    } else {
      if (account) {
        openedFor = account;
        setAccountStorage(account);
      }
      body = (
        <Suspense fallback={<Splash />}>
          <AccountWorkspace account={account} />
        </Suspense>
      );
    }
  }

  return (
    <>
      <TitleBar showSync={workspace} />
      {body}
    </>
  );
}
