// Talking to Dovli's AI routes (/api/ai and /api/ai/connection), and keeping a per-device count of
// this month's use. When signed in, the server keeps the real count per account and enforces the
// monthly Dovli AI allowance. People can also connect their own Anthropic or OpenAI key:
// with accounts, the server keeps it sealed; without accounts, it stays on this device.

import { useSyncExternalStore } from "react";
import { PROVIDERS, type OwnProviderId, type ProviderId } from "./aiProviders";
import { auth } from "./auth";

export { PROVIDERS, type OwnProviderId, type ProviderId };

export type AIAction = "improve" | "shorten" | "longer" | "fix" | "friendly" | "professional" | "translate" | "summarize" | "continue" | "custom" | "review";

export interface AIUsage {
  /** Dovli AI tokens used this month (a token is roughly ¾ of a word). */
  used: number;
  limit: number;
  month: string;
  /** True when AI can be used right now (Dovli AI, or a connected key). */
  available: boolean;
  /** Why not: "sign-in" (sign in first) or "no-key" (no Dovli AI on this server and no key connected). */
  reason: "sign-in" | "no-key" | null;
  /** Where the count comes from: the account (server) or this device. */
  source: "account" | "device";
  /** The AI in use: groq is Dovli AI; anthropic/openai are the person's own key. */
  provider: ProviderId;
  model: string | null;
  /** Last 4 characters of a connected key. */
  keyHint: string | null;
  /** Whether this server offers Dovli AI at all. */
  dovliAI: boolean;
  /** Whether people can connect their own key here. */
  canConnect: boolean;
  /** Where a connected key lives. */
  keyStorage: "account" | "device";
  /** False until the first answer from the server. */
  loaded: boolean;
}

const KEY = "dovli.ai.usage.v1";
const DEVICE_KEY = "dovli.ai.key.v1"; // only without accounts
const monthNow = () => new Date().toISOString().slice(0, 7);

let usage: AIUsage = {
  used: 0,
  limit: 0,
  month: monthNow(),
  available: false,
  reason: null,
  source: "device",
  provider: "groq",
  model: null,
  keyHint: null,
  dovliAI: false,
  canConnect: false,
  keyStorage: "account",
  loaded: false,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<AIUsage>) => {
  usage = { ...usage, ...patch };
  listeners.forEach((l) => l());
};

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (raw.month === monthNow()) usage = { ...usage, used: raw.used ?? 0 };
  } catch {
    /* ignore */
  }
}

function saveLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ month: usage.month, used: usage.used }));
  } catch {
    /* ignore */
  }
}

/* A key kept on this device (only when Dovli runs without accounts). */
type DeviceKey = { provider: OwnProviderId; model: string; key: string };
function deviceKey(): DeviceKey | null {
  try {
    const v = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "null");
    return v && (v.provider === "anthropic" || v.provider === "openai") && typeof v.key === "string" ? v : null;
  } catch {
    return null;
  }
}
function setDeviceKey(v: DeviceKey | null) {
  try {
    if (v) localStorage.setItem(DEVICE_KEY, JSON.stringify(v));
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* private mode: the key lasts until the tab closes */
  }
}

/** Headers for Dovli's AI routes: sign-in, and a key kept on this device (only without accounts). */
export async function aiHeaders(): Promise<Record<string, string>> {
  const token = await auth.accessToken().catch(() => null);
  const h: Record<string, string> = { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const d = usage.keyStorage === "device" ? deviceKey() : null;
  if (d) Object.assign(h, { "x-dovli-ai-provider": d.provider, "x-dovli-ai-model": d.model, "x-dovli-ai-key": d.key });
  return h;
}

/** Ask the server which AI is in use, whether it's ready, and how much is left this month. */
export async function refreshUsage() {
  if (typeof window !== "undefined") readLocal();
  try {
    const res = await fetch("/api/ai", { headers: await aiHeaders() });
    const data = await res.json();
    const storage = data.keyStorage === "device" ? "device" : "account";
    // Without accounts the server only sees the key if we sent it; ask again now we know.
    if (storage === "device" && usage.keyStorage !== "device" && deviceKey()) {
      usage = { ...usage, keyStorage: "device" };
      return refreshUsage();
    }
    set({
      available: !!data.available,
      reason: data.reason ?? null,
      limit: data.limit ?? 0,
      month: data.month ?? monthNow(),
      used: data.source === "account" ? data.used : usage.used,
      source: data.source ?? "device",
      provider: data.provider ?? "groq",
      model: data.model ?? null,
      keyHint: data.keyHint ?? null,
      dovliAI: !!data.dovliAI,
      canConnect: !!data.canConnect,
      keyStorage: storage,
      loaded: true,
    });
  } catch {
    set({ available: false, loaded: true });
  }
  return usage;
}

export class AIError extends Error {}

export async function runAI(action: AIAction, text: string, opts: { language?: string; instruction?: string; focus?: string } = {}): Promise<string> {
  const own = usage.provider !== "groq";
  if (!own && usage.limit && usage.used >= usage.limit) throw new AIError("You've used this month's Dovli AI allowance. It resets on the 1st, or connect your own key in Settings → AI.");
  const res = await fetch("/api/ai", { method: "POST", headers: await aiHeaders(), body: JSON.stringify({ action, text, ...opts }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(data.error ?? "AI is not available right now. Please try again.");
  countUsage(data.own, (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0), data.used, data.limit);
  return String(data.text ?? "").trim();
}

/** Count Dovli AI tokens just spent (people's own keys don't count). */
export function countUsage(own: boolean, spent: number, used?: number, limit?: number) {
  if (own) return;
  usage = { ...usage, used: used ?? usage.used + spent, limit: limit ?? usage.limit };
  if (usage.source === "device") saveLocal();
  set({});
}

/** Stop early when this month's Dovli AI allowance is used up. */
export function allowanceLeft(): boolean {
  return usage.provider !== "groq" || !usage.limit || usage.used < usage.limit;
}

/**
 * Connect your own provider. The server tests the key with one tiny request first, so a wrong key
 * is never saved. Leave `key` empty to change only the model of the key already connected.
 */
export async function connectProvider(provider: OwnProviderId, model: string, key: string) {
  const device = usage.keyStorage === "device";
  const old = device ? deviceKey() : null;
  // On a device without accounts, a model change re-checks the key kept here.
  const sendKey = key.trim() || (old?.provider === provider ? old.key : "");
  const res = await fetch("/api/ai/connection", { method: "POST", headers: await aiHeaders(), body: JSON.stringify({ provider, model, key: device ? sendKey : key.trim() }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(data.error ?? "Couldn't connect. Please try again.");
  if (device && sendKey) setDeviceKey({ provider, model: data.model ?? model, key: sendKey });
  await refreshUsage();
}

/** Back to Dovli AI. */
export async function disconnectProvider() {
  if (usage.keyStorage === "device") setDeviceKey(null);
  else {
    const res = await fetch("/api/ai/connection", { method: "DELETE", headers: await aiHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new AIError(data.error ?? "Couldn't remove the key. Please try again.");
    }
  }
  await refreshUsage();
}

/** "Dovli AI", "Claude (your key)" and so on, for labels. */
export function aiLabel(u: Pick<AIUsage, "provider" | "model">): string {
  if (u.provider === "groq") return "Dovli AI";
  const p = PROVIDERS[u.provider];
  const model = p.models.find((m) => m.id === u.model)?.label ?? u.model ?? p.name;
  return `${model}, your ${p.name} key`;
}

export function useAIUsage(): AIUsage {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => usage,
    () => usage,
  );
}
