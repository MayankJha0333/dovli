// The welcome tab: pin the icon, connect, and which surface does what. Each step ticks itself off.

import { connection } from "./api.js";

const $ = (id) => document.getElementById(id);

// Chrome tells extensions whether they're pinned, but not when that changes, so look every second.
async function checkPin() {
  const pinned = (await chrome.action.getUserSettings().catch(() => ({}))).isOnToolbar;
  $("step-pin").classList.toggle("done", !!pinned);
  $("pin-state").textContent = pinned ? "Pinned. Dovli's icon is in your toolbar." : "Not pinned yet";
}
setInterval(checkPin, 1000);
void checkPin();

async function showConnection() {
  const { secret, account } = await connection();
  $("step-connect").classList.toggle("done", !!secret);
  $("connect").hidden = !!secret;
  $("connect-state").textContent = secret ? `Connected${account?.email ? ` as ${account.email}` : ""}. You're all set.` : "";
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "secret" in changes) void showConnection();
});
void showConnection();

$("connect").addEventListener("click", async () => {
  $("connect").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "start-connect" }).catch(() => null);
  $("connect").disabled = false;
  $("connect-state").textContent = r?.ok ? "Finish in the Dovli tab that just opened." : (r?.error ?? "Couldn't open Dovli. Please try again.");
});

// Show the shortcuts as set on this computer (people can change them).
chrome.commands.getAll().then((commands) => {
  for (const kbd of document.querySelectorAll("kbd[data-command]")) {
    kbd.textContent = commands.find((c) => c.name === kbd.dataset.command)?.shortcut ?? "";
  }
});
