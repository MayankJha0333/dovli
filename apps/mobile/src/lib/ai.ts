// AI on the phone: which AI the account uses (Dovli AI, or the person's own key), switching it, and
// running one writing action on a page. The same server routes as the web app (/api/ai,
// /api/ai/connection, /api/ai/models), so a change here shows up on the web too.
//
// The provider list mirrors apps/web/src/lib/aiProviders.ts. Keep the two in step.

import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api";

export type ProviderId = "groq" | "groqcloud" | "openrouter" | "anthropic" | "openai";
export type OwnProviderId = Exclude<ProviderId, "groq">;

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
  free?: boolean;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  blurb: string;
  keyPrefix?: string;
  keysSite?: string;
  models: ModelOption[];
  defaultModel: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq: {
    id: "groq",
    name: "Dovli AI",
    blurb: "Free with your account, with a monthly allowance.",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Strong writing, very fast" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "Fastest" },
    ],
    defaultModel: "openai/gpt-oss-120b",
  },
  groqcloud: {
    id: "groqcloud",
    name: "Groq",
    blurb: "Open models at very high speed.",
    keyPrefix: "gsk_",
    keysSite: "console.groq.com/keys",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Strong writing, very fast" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "Fastest" },
    ],
    defaultModel: "openai/gpt-oss-120b",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    blurb: "Hundreds of models from every lab, on one key.",
    keyPrefix: "sk-or-",
    keysSite: "openrouter.ai/settings/keys",
    models: [
      { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", hint: "Fast and low-cost" },
      { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", hint: "Best balance" },
      { id: "openai/gpt-6-luna", label: "GPT-6 Luna", hint: "Fast and low-cost" },
      { id: "google/gemini-4-argon", label: "Gemini 4 Argon", hint: "Google's model" },
    ],
    defaultModel: "anthropic/claude-haiku-5.5",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    blurb: "Claude models.",
    keyPrefix: "sk-ant-",
    keysSite: "console.anthropic.com/settings/keys",
    models: [
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", hint: "Fast and low-cost" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Best balance" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "Most capable" },
    ],
    defaultModel: "claude-haiku-5-5",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    blurb: "GPT models.",
    keyPrefix: "sk-",
    keysSite: "platform.openai.com/api-keys",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "Fast and low-cost" },
      { id: "gpt-6-sol", label: "GPT-6 Sol", hint: "Best balance" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", hint: "Older, very low-cost" },
    ],
    defaultModel: "gpt-6-luna",
  },
};

export const OWN_PROVIDERS: OwnProviderId[] = ["groqcloud", "openrouter", "anthropic", "openai"];

/** A light check of a pasted key before it goes to the server (which tests it for real). */
export function checkKey(provider: OwnProviderId, key: string): string | null {
  const k = key.trim();
  if (!k) return "Paste your API key.";
  if (k.length < 20 || k.length > 300 || /\s/.test(k)) return "That doesn't look like an API key.";
  const owner = k.startsWith("sk-ant-") ? "anthropic" : k.startsWith("sk-or-") ? "openrouter" : k.startsWith("gsk_") ? "groqcloud" : null;
  if (owner && owner !== provider) return `That's a ${PROVIDERS[owner].name} key. Choose ${PROVIDERS[owner].name} instead.`;
  const want = PROVIDERS[provider].keyPrefix;
  if (want && !k.startsWith(want)) return `${PROVIDERS[provider].name} keys start with “${want}”. Check you copied the whole key.`;
  return null;
}

/* ---------------------------------------------------------------- which AI is in use */

export interface AIState {
  loaded: boolean;
  /** Couldn't ask the server (offline, or no server). */
  failed: boolean;
  available: boolean;
  reason: "sign-in" | "no-key" | null;
  provider: ProviderId;
  model: string | null;
  /** The end of a connected key, like "…4f2a". */
  keyHint: string | null;
  /** Whether this server offers Dovli AI at all. */
  dovliAI: boolean;
  canConnect: boolean;
  /** This month's Dovli AI allowance, in tokens. */
  limit: number;
  used: number;
}

let state: AIState = { loaded: false, failed: false, available: false, reason: null, provider: "groq", model: null, keyHint: null, dovliAI: false, canConnect: false, limit: 0, used: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<AIState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useAI(): AIState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export async function refreshAI(): Promise<AIState> {
  try {
    const d = await api("/api/ai");
    set({
      loaded: true,
      failed: false,
      available: !!d.available,
      reason: d.reason ?? null,
      provider: (d.provider as ProviderId) ?? "groq",
      model: d.model ?? null,
      keyHint: d.keyHint ?? null,
      dovliAI: !!d.dovliAI,
      canConnect: !!d.canConnect,
      limit: d.limit ?? 0,
      used: d.used ?? 0,
    });
  } catch {
    set({ loaded: true, failed: true });
  }
  return state;
}

/** "Dovli AI", "Anthropic (your key)": for labels. */
export function aiLabel(s: Pick<AIState, "provider">): string {
  return s.provider === "groq" ? "Dovli AI" : `${PROVIDERS[s.provider].name} (your key)`;
}

export function modelLabel(provider: ProviderId, model: string | null): string {
  if (!model) return "";
  return PROVIDERS[provider].models.find((m) => m.id === model)?.label ?? model.split("/").pop() ?? model;
}

/** Use Dovli AI, on one of its models (this also removes a connected key). */
export async function chooseDovliModel(model: string) {
  await api("/api/ai/connection", { body: { provider: "groq", model } });
  await refreshAI();
}

/** Connect your own key. The server tests it with one tiny request first, so a wrong key is never saved. */
export async function connectKey(provider: OwnProviderId, model: string, key: string) {
  await api("/api/ai/connection", { body: { provider, model, key: key.trim() }, timeoutMs: 40_000 });
  await refreshAI();
}

/** Back to Dovli AI. */
export async function disconnectKey() {
  await api("/api/ai/connection", { method: "DELETE" });
  await refreshAI();
}

/** Every model a provider offers right now (OpenRouter and Groq list them live), else the short list. */
export async function listModels(provider: ProviderId, key = ""): Promise<ModelOption[]> {
  try {
    const d = await api<{ models: ModelOption[] }>("/api/ai/models", { body: { provider, key } });
    if (Array.isArray(d.models) && d.models.length) return d.models;
  } catch {
    /* the short list below */
  }
  return PROVIDERS[provider].models;
}

/* ---------------------------------------------------------------- running AI on a page */

export type PageAction = "summarize" | "review";
export type ReviewFocus = "clarity" | "grammar" | "structure" | "tone";

/** One writing action on a page's text, answered in plain text. */
export async function runAI(action: PageAction, text: string, opts: { focus?: ReviewFocus } = {}): Promise<string> {
  try {
    const d = await api<{ text: string; used?: number; limit?: number }>("/api/ai", { body: { action, text, ...opts }, timeoutMs: 60_000 });
    if (typeof d.used === "number") set({ used: d.used, limit: d.limit ?? state.limit });
    return String(d.text ?? "").trim();
  } catch (e) {
    throw e instanceof ApiError ? e : new ApiError("AI isn't available right now. Please try again.");
  }
}
