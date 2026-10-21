import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, DesktopCommand } from "@/lib/desktop";
import { CONFIG_ARG, IPC, type BridgeConfig, type GoogleSignInReply } from "../shared/ipc";

// The only door between the window (the web app, sandboxed, no Node) and the rest of the app:
// window.dovliDesktop, typed in apps/web/src/lib/desktop.ts.

const arg = process.argv.find((a) => a.startsWith(CONFIG_ARG));
const config: BridgeConfig = JSON.parse(decodeURIComponent(arg?.slice(CONFIG_ARG.length) ?? "{}"));

let beforeClose: (() => Promise<void>) | null = null;
ipcRenderer.on(IPC.beforeClose, async () => {
  try {
    await beforeClose?.();
  } finally {
    ipcRenderer.send(IPC.beforeCloseDone);
  }
});

const bridge: DesktopBridge = {
  platform: config.platform,
  version: config.version,
  siteUrl: config.siteUrl,
  async googleSignIn() {
    const reply: GoogleSignInReply = await ipcRenderer.invoke(IPC.googleSignIn);
    if ("error" in reply) throw new Error(reply.error);
    return reply.token;
  },
  cancelGoogleSignIn: () => ipcRenderer.send(IPC.googleSignInCancel),
  setTheme: (theme) => ipcRenderer.send(IPC.setTheme, theme),
  onCommand(cb) {
    const listener = (_: unknown, command: DesktopCommand) => cb(command);
    ipcRenderer.on(IPC.command, listener);
    return () => void ipcRenderer.removeListener(IPC.command, listener);
  },
  onBeforeClose(cb) {
    beforeClose = cb;
  },
};

contextBridge.exposeInMainWorld("dovliDesktop", bridge);
