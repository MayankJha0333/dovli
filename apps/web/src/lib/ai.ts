// Talking to Dovli's AI route (/api/ai), and keeping a per-device count of this month's use.
// When signed in, the server keeps the real count per account and enforces the monthly allowance.

import { useSyncExternalStore } from "react";
import { auth } from "./auth";

export type AIAction = "improve" | "shorten" | "longer" | "fix" | "friendly" | "professional" | "translate" | "summarize" | "continue" | "custom" | "review";

export interface AIUsage {
  /** Tokens used this month (a token is roughly ¾ of a word). */
  used: number;
  limit: number;
  month: string;
  /** False when the server has no AI key set. */
  available: boolean;
  /** Where the count comes from: the account (server) or this device. */
  source: "account" | "device";
}

const KEY = "dovli.ai.usage.v1";
const monthNow = () => new Date().toISOString().slice(0, 7);

let usage: AIUsage = { used: 0, limit: 0, month: monthNow(), available: false, source: "device" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

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

async function headers(): Promise<HeadersInit> {
  const token = await auth.accessToken().catch(() => null);
  return { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
}

/** Ask the server whether AI is set up, and how much is left this month. */
export async function refreshUsage() {
  if (typeof window !== "undefined") readLocal();
  try {
    const res = await fetch("/api/ai", { headers: await headers() });
    const data = await res.json();
    usage = {
      ...usage,
      available: !!data.available,
      limit: data.limit ?? 0,
      month: data.month ?? monthNow(),
      used: data.source === "account" ? data.used : usage.used,
      source: data.source ?? "device",
    };
  } catch {
    usage = { ...usage, available: false };
  }
  emit();
  return usage;
}

export class AIError extends Error {}

export async function runAI(action: AIAction, text: string, opts: { language?: string; instruction?: string; focus?: string } = {}): Promise<string> {
  if (usage.limit && usage.used >= usage.limit) throw new AIError("You've used this month's AI allowance. It resets on the 1st.");
  const res = await fetch("/api/ai", { method: "POST", headers: await headers(), body: JSON.stringify({ action, text, ...opts }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(data.error ?? "AI is not available right now. Please try again.");
  const spent = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  usage = { ...usage, used: data.used ?? usage.used + spent, limit: data.limit ?? usage.limit };
  if (usage.source === "device") saveLocal();
  emit();
  return String(data.text ?? "").trim();
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
