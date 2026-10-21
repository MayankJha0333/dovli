// Message names between the main process and the window's preload script.

export const IPC = {
  googleSignIn: "dovli:google-sign-in",
  googleSignInCancel: "dovli:google-sign-in-cancel",
  setTheme: "dovli:set-theme",
  command: "dovli:command",
  beforeClose: "dovli:before-close",
  beforeCloseDone: "dovli:before-close-done",
} as const;

/** What the preload script needs to know, passed on the window's command line. */
export interface BridgeConfig {
  platform: "darwin" | "win32" | "linux";
  version: string;
  siteUrl: string;
}

export const CONFIG_ARG = "--dovli-config=";

/** Errors can't cross IPC cleanly (Electron rewords them), so sign-in answers with this. */
export type GoogleSignInReply = { token: string | null } | { error: string };
