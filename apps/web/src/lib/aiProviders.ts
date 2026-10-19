// The AI providers Dovli can use, their models, and light checks on pasted keys. Shared by the
// server (lib/server/aiCore.ts, which does the talking) and Settings → AI (which shows the choices).

// "groq" is Dovli AI: Groq on the server's key, with a monthly allowance. "groqcloud" is Groq on
// the person's own key. OpenRouter reaches hundreds of models from every lab with one key.
export type ProviderId = "groq" | "groqcloud" | "openrouter" | "anthropic" | "openai";
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
  /** A few good picks. Groq and OpenRouter also list every model live (see /api/ai/models). */
  models: ModelOption[];
  defaultModel: string;
  /** The full model list can be fetched from the provider, and any model id typed in. */
  liveModels?: boolean;
  /** One line for the provider card in Settings. */
  blurb: string;
}

// Model lists checked against each provider's docs in October 2026 (Groq now keeps its Llama
// models for enterprise accounts, so they're left out). A model that's been retired
// gives a clear "model not found" message, and people can pick another in Settings.
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
    blurb: "Open models at very high speed, on your own Groq key.",
    keysUrl: "https://console.groq.com/keys",
    keyPrefix: "gsk_",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Strong writing, very fast" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "Fastest" },
    ],
    defaultModel: "openai/gpt-oss-120b",
    liveModels: true,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    blurb: "Hundreds of models from every lab, on one key.",
    keysUrl: "https://openrouter.ai/settings/keys",
    keyPrefix: "sk-or-",
    models: [
      { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", hint: "Fast and low-cost" },
      { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", hint: "Best balance" },
      { id: "openai/gpt-6-luna", label: "GPT-6 Luna", hint: "Fast and low-cost" },
      { id: "google/gemini-4-argon", label: "Gemini 4 Argon", hint: "Google's model" },
    ],
    defaultModel: "anthropic/claude-haiku-5.5",
    liveModels: true,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    blurb: "Claude models, on your own API key.",
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
    blurb: "GPT models, on your own API key.",
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

export const OWN_PROVIDERS: OwnProviderId[] = ["groqcloud", "openrouter", "anthropic", "openai"];
export const isOwnProvider = (v: unknown): v is OwnProviderId => OWN_PROVIDERS.includes(v as OwnProviderId);

/** Dovli AI runs only the models in its own list (the server pays for them). */
export const dovliModel = (model: unknown): string | null => (PROVIDERS.groq.models.some((m) => m.id === model) ? (model as string) : null);

/** A model id is fine if it's in our list, or looks like a plausible id someone typed. */
export function cleanModel(provider: ProviderId, model: unknown): string {
  const m = typeof model === "string" ? model.trim() : "";
  if (m && /^~?[\w.:/@+-]{2,120}$/.test(m)) return m;
  return PROVIDERS[provider].defaultModel;
}

/** A light check of a pasted key: right shape, no spaces, not absurdly long. */
export function checkKey(provider: OwnProviderId, key: unknown): string | null {
  const k = typeof key === "string" ? key.trim() : "";
  if (!k) return "Paste your API key.";
  if (k.length < 20 || k.length > 300 || /\s/.test(k)) return "That doesn't look like an API key.";
  // The usual mix-up: a key from one provider pasted under another.
  const owner = k.startsWith("sk-ant-") ? "anthropic" : k.startsWith("sk-or-") ? "openrouter" : k.startsWith("gsk_") ? "groqcloud" : null;
  if (owner && owner !== provider) return `That's ${owner === "anthropic" ? "an" : "a"} ${PROVIDERS[owner].name} key. Choose ${PROVIDERS[owner].name} instead.`;
  const want = PROVIDERS[provider].keyPrefix;
  if (want && !k.startsWith(want)) return `${PROVIDERS[provider].name} keys start with “${want}”. Check you copied the whole key.`;
  return null;
}
