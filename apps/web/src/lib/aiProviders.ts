// The AI providers Dovli can use, their models, and light checks on pasted keys. Shared by the
// server (lib/server/aiCore.ts, which does the talking) and Settings → AI (which shows the choices).

export type ProviderId = "groq" | "anthropic" | "openai";
/** Providers people connect with their own key. */
export type OwnProviderId = Exclude<ProviderId, "groq">;

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** Where to get an API key. */
  keysUrl?: string;
  /** What a key starts with, to catch pasting the wrong thing. */
  keyPrefix?: string;
  models: ModelOption[];
  defaultModel: string;
}

// Model lists checked against each provider's docs in October 2026. A model that's been retired
// gives a clear "model not found" message, and people can pick another in Settings.
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq: {
    id: "groq",
    name: "Dovli AI",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Strong writing, very fast" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", hint: "Good all-rounder" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "Fastest" },
    ],
    defaultModel: "openai/gpt-oss-120b",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    keysUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-",
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
    keysUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "Fast and low-cost" },
      { id: "gpt-6-sol", label: "GPT-6 Sol", hint: "Best balance" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", hint: "Older, very low-cost" },
    ],
    defaultModel: "gpt-6-luna",
  },
};

export const isOwnProvider = (v: unknown): v is OwnProviderId => v === "anthropic" || v === "openai";

/** A model id is fine if it's in our list, or looks like a plausible id someone typed. */
export function cleanModel(provider: ProviderId, model: unknown): string {
  const m = typeof model === "string" ? model.trim() : "";
  if (m && /^[\w.:/-]{2,80}$/.test(m)) return m;
  return PROVIDERS[provider].defaultModel;
}

/** A light check of a pasted key: right shape, no spaces, not absurdly long. */
export function checkKey(provider: OwnProviderId, key: unknown): string | null {
  const k = typeof key === "string" ? key.trim() : "";
  if (!k) return "Paste your API key.";
  if (k.length < 20 || k.length > 300 || /\s/.test(k)) return "That doesn't look like an API key.";
  const want = PROVIDERS[provider].keyPrefix;
  if (want && !k.startsWith(want)) return `${PROVIDERS[provider].name} keys start with “${want}”. Check you copied the whole key.`;
  if (provider === "openai" && k.startsWith("sk-ant-")) return "That's an Anthropic key. Choose Anthropic instead.";
  return null;
}
