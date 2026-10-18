// This browser as a "device" in the person's record (users/{uid}/devices/{id}): a random id kept
// in this browser, what it is ("Chrome on macOS"), the app version, and whether it's installed as
// an app. Sent once each time the app opens, so the record shows where Dovli is used and when.

import { nanoid } from "nanoid";
import { auth } from "./auth";

const KEY = "dovli.device.v1";

function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = `web-${nanoid(16)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `web-${nanoid(16)}`; // storage blocked: a new id each time, which is fine
  }
}

/** "Chrome on macOS", from the browser's own description of itself. */
export function deviceName(ua = navigator.userAgent): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

let sent = false;
export async function checkInDevice() {
  if (sent) return;
  sent = true;
  try {
    const token = await auth.accessToken();
    if (!token) return void (sent = false);
    const installed = typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches;
    const res = await fetch("/api/me/device", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: deviceId(), platform: "web", name: deviceName(), appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "", installed }),
    });
    await res.text(); // read the reply, so the browser closes the request
    if (!res.ok) sent = false;
  } catch {
    sent = false; // try again next time the app opens
  }
}
