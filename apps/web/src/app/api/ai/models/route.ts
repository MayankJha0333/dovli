// The models a provider offers, for the model picker in Settings → AI.
//   POST { provider, key? }  → { models: [{ id, label, hint, free? }], live }
// OpenRouter's list is public (cached here for an hour). Groq's needs a key: the one being pasted
// (key), or the one already connected. Dovli AI, Anthropic and OpenAI show Dovli's own short list.

import { NextResponse } from "next/server";
import { PROVIDERS, checkKey } from "@/lib/server/aiCore";
import { firebaseOnServer, userFromRequest } from "@/lib/server/firebaseAdmin";
import { ownChoice } from "@/lib/server/aiEngine";
import { groqModels, openRouterModels, type LiveModel } from "@/lib/server/aiModels";
import { noStore, readJson, sameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

let openRouterCache: { at: number; models: LiveModel[] } | null = null;
const HOUR = 3_600_000;

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ error: "That request came from another site." }, 403);
  const user = firebaseOnServer ? await userFromRequest(req) : null;
  if (firebaseOnServer && !user) return reply({ error: "Sign in first." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await readJson(req, 1_000);
  } catch {
    return reply({ error: "That request didn't make sense." }, 400);
  }
  const provider = body.provider;
  const fallback = (p: keyof typeof PROVIDERS) => reply({ models: PROVIDERS[p].models, live: false });

  if (provider === "openrouter") {
    try {
      if (!openRouterCache || Date.now() - openRouterCache.at > HOUR) {
        const models = openRouterModels(await fetchJson("https://openrouter.ai/api/v1/models"));
        if (models.length) openRouterCache = { at: Date.now(), models };
      }
      return openRouterCache ? reply({ models: openRouterCache.models, live: true }) : fallback("openrouter");
    } catch {
      return openRouterCache ? reply({ models: openRouterCache.models, live: true }) : fallback("openrouter");
    }
  }

  if (provider === "groqcloud") {
    // The key being pasted, else the Groq key already connected.
    const typed = typeof body.key === "string" ? body.key.trim() : "";
    let key = typed && !checkKey("groqcloud", typed) ? typed : "";
    if (!key) {
      const mine = await ownChoice(req, user).catch(() => null);
      if (mine?.provider === "groqcloud" && mine.apiKey) key = mine.apiKey;
    }
    if (!key) return fallback("groqcloud");
    try {
      const models = groqModels(await fetchJson("https://api.groq.com/openai/v1/models", { authorization: `Bearer ${key}` }));
      return models.length ? reply({ models, live: true }) : fallback("groqcloud");
    } catch {
      return fallback("groqcloud");
    }
  }

  if (provider === "groq" || provider === "anthropic" || provider === "openai") return fallback(provider);
  return reply({ error: "Choose an AI provider." }, 400);
}
