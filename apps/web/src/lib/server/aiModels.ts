// Every model a provider offers right now, for the model picker in Settings → AI. OpenRouter
// lists hundreds (public, no key needed); Groq lists the ones the person's key can use. The
// lists come from the providers, so new models show up without a Dovli update.
// No Next.js or Firebase here, so it's easy to test (aiModels.test.ts).

import type { ModelOption } from "../aiProviders";

export interface LiveModel extends ModelOption {
  /** Costs nothing to use (OpenRouter's ":free" models). */
  free?: boolean;
}

const per1M = (perToken: unknown) => {
  const n = Number(perToken);
  if (!Number.isFinite(n) || n < 0) return null;
  const v = Math.round(n * 1_000_000 * 1000) / 1000; // per million tokens, to 3 decimals
  return v >= 10 ? v.toFixed(0) : String(v);
};
const contextText = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}K`) + " context" : "";
};

/** OpenRouter's /api/v1/models answer → the text models, with price and context in the hint. */
export function openRouterModels(json: any): LiveModel[] {
  const list = Array.isArray(json?.data) ? json.data : [];
  const out: LiveModel[] = [];
  for (const m of list) {
    if (typeof m?.id !== "string") continue;
    const outputs: unknown[] = m.architecture?.output_modalities ?? ["text"];
    const inputs: unknown[] = m.architecture?.input_modalities ?? ["text"];
    if (!outputs.includes("text") || !inputs.includes("text")) continue;
    const prompt = per1M(m.pricing?.prompt);
    const completion = per1M(m.pricing?.completion);
    const free = prompt === "0" && completion === "0";
    // Negative prices mean a router whose price depends on the model it picks.
    const price = free ? "Free" : prompt && completion ? `$${prompt} in / $${completion} out per 1M tokens` : "Price varies";
    out.push({
      id: m.id,
      label: String(m.name || m.id).slice(0, 80),
      hint: [price, contextText(m.context_length)].filter(Boolean).join(" · "),
      ...(free ? { free: true } : {}),
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Groq's /openai/v1/models answer → the chat models (no speech, text-to-speech or safety filters). */
export function groqModels(json: any): LiveModel[] {
  const list = Array.isArray(json?.data) ? json.data : [];
  return list
    .filter((m: any) => typeof m?.id === "string" && m.active !== false && !/whisper|tts|orpheus|playai|guard|distil/i.test(m.id))
    .map((m: any) => ({ id: m.id, label: m.id, hint: [m.owned_by, contextText(m.context_window)].filter(Boolean).join(" · ") }))
    .sort((a: LiveModel, b: LiveModel) => a.id.localeCompare(b.id));
}
