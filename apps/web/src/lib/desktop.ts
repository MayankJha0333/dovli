import { useSyncExternalStore } from "react";

// Dovli for Mac and Windows (apps/desktop) runs this same app in its own window. Its preload script
// puts this bridge on `window.dovliDesktop`; in a browser tab there is none. The app uses it for the
// few things a desktop window does differently from a tab.

/** Commands from the desktop app's menu bar. */
export type DesktopCommand = "new-page" | "new-board" | "search" | "settings" | "toggle-sidebar" | "assistant" | "sync-now" | "back" | "forward";

export interface DesktopBridge {
  platform: "darwin" | "win32" | "linux";
  /** The desktop app's version. */
  version: string;
  /** Dovli's website (https://dovli.in), for links that must work outside the app. */
  siteUrl: string;
  /**
   * Google sign-in in the system browser, which can show Google's page (a desktop window can't).
   * Resolves with a one-time Firebase custom token, or null if it was cancelled or timed out.
   */
  googleSignIn(): Promise<string | null>;
  cancelGoogleSignIn(): void;
  /** The current theme's colours, for the window's title bar and the next launch's first paint. */
  setTheme(theme: { bg: string; ink: string; dark: boolean }): void;
  onCommand(cb: (command: DesktopCommand) => void): () => void;
  /** Runs before the window closes for good: finish writing to this device first. */
  onBeforeClose(cb: () => Promise<void>): void;
}

export const desktop: DesktopBridge | null =
  typeof window === "undefined" ? null : ((window as unknown as { dovliDesktop?: DesktopBridge }).dovliDesktop ?? null);

/** This site's public address, for links people open elsewhere. The desktop app's own (app://) only works inside it. */
export const siteOrigin = () => desktop?.siteUrl ?? location.origin;

let browserSignIn = false;
const listeners = new Set<() => void>();

/** Google sign-in through the system browser; while it waits, useBrowserSignIn() is true. */
export async function signInThroughBrowser(bridge: DesktopBridge): Promise<string | null> {
  const set = (v: boolean) => {
    browserSignIn = v;
    listeners.forEach((l) => l());
  };
  set(true);
  try {
    return await bridge.googleSignIn();
  } finally {
    set(false);
  }
}

export function useBrowserSignIn(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => browserSignIn,
    () => false,
  );
}
