// The AI providers Dovli can use, and how to talk to each. No Next.js or Firebase here, so it's
// easy to test (aiCore.test.ts).
//
//   groq       Dovli's own AI, on the server's key (GROQ_KEY). Free for everyone, with a monthly
//              allowance per account. This is the default.
//   anthropic  The person's own Anthropic key (Claude).
//   openai     The person's own OpenAI key (GPT).
//
// People's own keys are stored encrypted (see sealKey/openKey) and are never sent back to the app.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { PROVIDERS, type ProviderId } from "../aiProviders";

export { PROVIDERS, checkKey, cleanModel, dovliModel, isOwnProvider, type OwnProviderId, type ProviderId } from "../aiProviders";

/* ---------- Talking to a provider ---------- */

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  provider: ProviderId;
  apiKey: string;
  model: string;
  system: string;
  /** One question; or a whole conversation in `messages`. */
  prompt?: string;
  messages?: AIMessage[];
  maxTokens: number;
  /** Ask for a JSON object back (the assistant's replies). */
  json?: boolean;
}

/** The conversation to send: the messages, or the single prompt as one. */
const turns = (r: AIRequest): AIMessage[] => (r.messages?.length ? r.messages : [{ role: "user", content: r.prompt ?? "" }]);

export interface AIResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** A failure to show people, in plain words. `status` is the HTTP status to answer with. */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public kind: "key" | "model" | "busy" | "quota" | "network" | "other" = "other",
  ) {
    super(message);
  }
}

/** The HTTP request for one call: address, headers and body. Kept separate so it can be tested. */
export function buildRequest(r: AIRequest): { url: string; headers: Record<string, string>; body: unknown } {
  if (r.provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": r.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: { model: r.model, max_tokens: r.maxTokens, system: r.system, messages: turns(r) },
    };
  }
  // Groq, OpenRouter and OpenAI all speak the OpenAI Chat Completions format.
  if (r.provider === "openrouter") {
    // Models that think first get a small thinking budget, kept out of the answer.
    const thinks = /(^|\/)(gpt-oss|gpt-[5-9]|o\d|deepseek-r|qwen3|.*thinking)/.test(r.model);
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        authorization: `Bearer ${r.apiKey}`,
        "content-type": "application/json",
        // Shown on openrouter.ai so people can see which app used their key.
        "x-title": "Dovli",
        ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? { "http-referer": `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` } : {}),
      },
      body: {
        model: r.model,
        messages: [{ role: "system", content: r.system }, ...turns(r)],
        ...(r.json ? { response_format: { type: "json_object" } } : {}),
        max_tokens: thinks ? r.maxTokens + 2_000 : r.maxTokens,
        ...(thinks ? { reasoning: { effort: "low", exclude: true } } : {}),
      },
    };
  }
  const groq = r.provider === "groq" || r.provider === "groqcloud";
  // Models that think before answering: Groq's GPT-OSS, and OpenAI's GPT-5/6 and o-series.
  const reasoning = groq ? r.model.startsWith("openai/gpt-oss") : /^(gpt-[5-9]|o\d)/.test(r.model);
  return {
    url: groq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
    headers: { authorization: `Bearer ${r.apiKey}`, "content-type": "application/json" },
    body: {
      model: r.model,
      messages: [{ role: "system", content: r.system }, ...turns(r)],
      ...(r.json ? { response_format: { type: "json_object" } } : {}),
      // Thinking models spend part of the budget thinking, so they get more room, and only a little thinking.
      max_completion_tokens: reasoning ? r.maxTokens + 2_000 : r.maxTokens,
      ...(reasoning ? { reasoning_effort: "low", ...(groq ? { include_reasoning: false } : {}) } : {}),
    },
  };
}

/** Pull the reply text and token counts out of a provider's answer. */
export function parseResponse(provider: ProviderId, data: any): AIResult {
  if (provider === "anthropic") {
    const text = (Array.isArray(data?.content) ? data.content : [])
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join("")
      .trim();
    return { text, inputTokens: data?.usage?.input_tokens ?? 0, outputTokens: data?.usage?.output_tokens ?? 0 };
  }
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  return { text, inputTokens: data?.usage?.prompt_tokens ?? 0, outputTokens: data?.usage?.completion_tokens ?? 0 };
}

/** Turn a provider's error into words for the person (never echoing their key). */
export function explainError(provider: ProviderId, status: number, data: any): AIProviderError {
  const own = provider !== "groq";
  const name = PROVIDERS[provider].name;
  const msg = String(data?.error?.message ?? data?.message ?? "").toLowerCase();
  if (status === 401 || status === 403) {
    return own
      ? new AIProviderError(`${name} didn't accept that API key. Check you copied all of it.`, 400, "key")
      : new AIProviderError("Dovli AI isn't available right now. Please try again later.", 503, "key");
  }
  if (status === 404 || msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist") || msg.includes("decommissioned"))) {
    return new AIProviderError(own ? `${name} doesn't offer that model to your key. Pick another model in Settings → AI.` : "That Dovli AI model isn't available right now. Pick another in Settings → AI.", 400, "model");
  }
  if (status === 402) {
    return own
      ? new AIProviderError(`Your ${name} account is out of credit. Add credit on ${name}'s website, or switch to Dovli AI.`, 402, "quota")
      : new AIProviderError("Dovli AI isn't available right now. Please try again later.", 503, "other");
  }
  if (status === 429) {
    if (own && (msg.includes("quota") || msg.includes("billing") || msg.includes("credit"))) {
      return new AIProviderError(`Your ${name} account is out of credit. Add credit on ${name}'s website, or switch to Dovli AI.`, 402, "quota");
    }
    return new AIProviderError("AI is busy right now. Try again in a moment.", 429, "busy");
  }
  if (status === 400 && own && (msg.includes("credit") || msg.includes("billing"))) {
    return new AIProviderError(`Your ${name} account is out of credit. Add credit on ${name}'s website, or switch to Dovli AI.`, 402, "quota");
  }
  if (status >= 500) return new AIProviderError(`${name} is having trouble right now. Try again in a moment.`, 502, "busy");
  return new AIProviderError("AI couldn't finish that. Please try again.", 502, "other");
}

/**
 * Make one call. `fetchImpl` is swappable for tests. `allowEmpty` is for the key check, where a
 * thinking model may spend its tiny budget thinking and say nothing: the key still worked.
 */
export async function callAI(
  r: AIRequest,
  { fetchImpl = fetch, timeoutMs = 60_000, allowEmpty = false }: { fetchImpl?: typeof fetch; timeoutMs?: number; allowEmpty?: boolean } = {},
): Promise<AIResult> {
  const { url, headers, body } = buildRequest(r);
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new AIProviderError(`Couldn't reach ${PROVIDERS[r.provider].name}. Check the connection and try again.`, 502, "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw explainError(r.provider, res.status, data);
  const out = parseResponse(r.provider, data);
  if (!out.text && !allowEmpty) throw new AIProviderError("AI sent back an empty answer. Please try again.", 502, "other");
  return out;
}

/**
 * Make one call and pass on the answer's text as it arrives (`onText` gets each new piece).
 * Same providers and errors as callAI. Token counts come from the provider when it sends them,
 * else they're estimated (about 4 characters a token).
 */
export async function streamAI(
  r: AIRequest,
  onText: (chunk: string) => void,
  { fetchImpl = fetch, timeoutMs = 60_000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<AIResult> {
  const { url, headers, body } = buildRequest({ ...r, json: false }); // JSON mode can't stream everywhere
  const streaming = { ...(body as object), stream: true, ...(r.provider === "openai" ? { stream_options: { include_usage: true } } : {}) };
  const name = PROVIDERS[r.provider].name;
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(streaming), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new AIProviderError(`Couldn't reach ${name}. Check the connection and try again.`, 502, "network");
  }
  if (!res.ok || !res.body) throw explainError(r.provider, res.status, await res.json().catch(() => ({})));

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const handle = (data: string) => {
    if (!data || data === "[DONE]") return;
    let j: any;
    try {
      j = JSON.parse(data);
    } catch {
      return;
    }
    if (j.error || j.type === "error") throw explainError(r.provider, j.error?.type === "overloaded_error" ? 529 : 500, j);
    let piece = "";
    if (r.provider === "anthropic") {
      if (j.type === "message_start") inputTokens = j.message?.usage?.input_tokens ?? 0;
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta") piece = j.delta.text ?? "";
      if (j.type === "message_delta") outputTokens = j.usage?.output_tokens ?? outputTokens;
    } else {
      piece = j.choices?.[0]?.delta?.content ?? "";
      const usage = j.usage ?? j.x_groq?.usage;
      if (usage) {
        inputTokens = usage.prompt_tokens ?? inputTokens;
        outputTokens = usage.completion_tokens ?? outputTokens;
      }
    }
    if (piece) {
      text += piece;
      onText(piece);
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) if (line.startsWith("data:")) handle(line.slice(5).trim());
    }
    if (buf.startsWith("data:")) handle(buf.slice(5).trim());
  } catch (e) {
    if (e instanceof AIProviderError) throw e;
    throw new AIProviderError(`${name} stopped answering part-way. Please try again.`, 502, "network");
  }
  if (!text.trim()) throw new AIProviderError("AI sent back an empty answer. Please try again.", 502, "other");
  if (!outputTokens) outputTokens = Math.ceil(text.length / 4);
  if (!inputTokens) inputTokens = Math.ceil((r.system.length + turns(r).reduce((n, m) => n + m.content.length, 0)) / 4);
  return { text: text.trim(), inputTokens, outputTokens };
}

/* ---------- Keeping people's keys safe ---------- */

// Keys are sealed with AES-256-GCM. The sealing key comes from AI_KEYS_SECRET, or (so nothing new
// has to be set up) from AUTH_CODE_SECRET, stretched with a label of its own so it never doubles as
// the sign-in code key. Changing that secret makes stored keys unreadable: people reconnect.

export function sealingKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "dovli", "dovli ai provider keys v1", 32));
}

export function sealKey(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function openKey(sealed: string, key: Buffer): string | null {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** The last 4 characters, to show which key is connected without showing the key. */
export const keyHint = (key: string) => key.slice(-4);
