// Connecting your own AI provider (Anthropic or OpenAI) in Settings → AI.
//   POST   { provider, model, key? }  Test the key with one tiny request, then save it (sealed).
//                                     Without a key: change the model of the key already connected.
//   DELETE                            Remove the key, back to Dovli AI.
// Without accounts (Dovli on one device), POST only tests the key; the app keeps it on the device.

import { NextResponse } from "next/server";
import { firebaseOnServer, userFromRequest } from "@/lib/server/firebaseAdmin";
import { AIProviderError, PROVIDERS, callAI, checkKey, cleanModel, isOwnProvider, keyHint } from "@/lib/server/aiCore";
import { canStoreKeys, clearChoice, loadChoice, saveChoice, saveModel } from "@/lib/server/aiKeys";
import { noStore, readJson, sameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

async function signedIn(req: Request) {
  if (!sameOrigin(req)) return { error: reply({ error: "That request came from another site." }, 403) };
  if (!firebaseOnServer) return { user: null };
  const user = await userFromRequest(req);
  if (!user) return { error: reply({ error: "Sign in to connect an AI provider." }, 401) };
  if (!canStoreKeys()) return { error: reply({ error: "This copy of Dovli can't store keys yet (the server needs AUTH_CODE_SECRET or AI_KEYS_SECRET)." }, 503) };
  return { user };
}

export async function POST(req: Request) {
  const who = await signedIn(req);
  if (who.error) return who.error;

  let body: Record<string, unknown>;
  try {
    body = await readJson(req, 2_000);
  } catch {
    return reply({ error: "That request didn't make sense." }, 400);
  }
  const provider = body.provider;
  if (!isOwnProvider(provider)) return reply({ error: "Choose Anthropic or OpenAI." }, 400);
  const model = cleanModel(provider, body.model);
  const key = typeof body.key === "string" ? body.key.trim() : "";

  // No new key: only the model changes, for the key that's already connected.
  if (!key) {
    if (!who.user) return reply({ error: "Paste your API key." }, 400);
    const current = await loadChoice(who.user.id);
    if (!current || current.provider !== provider) return reply({ error: "Paste your API key." }, 400);
    await saveModel(who.user.id, model);
    return reply({ provider, model, keyHint: current.keyHint });
  }

  const bad = checkKey(provider, key);
  if (bad) return reply({ error: bad }, 400);

  // One tiny request proves the key works and can use this model, before anything is saved.
  try {
    await callAI({ provider, apiKey: key, model, system: "Reply with the single word OK.", prompt: "Say OK.", maxTokens: 64 }, { timeoutMs: 20_000, allowEmpty: true });
  } catch (e) {
    const message = e instanceof AIProviderError ? e.message : `Couldn't check the key with ${PROVIDERS[provider].name}. Try again.`;
    return reply({ error: message, code: e instanceof AIProviderError ? e.kind : "other" }, e instanceof AIProviderError && e.status < 500 ? e.status : 502);
  }

  if (who.user) await saveChoice(who.user.id, provider, model, key);
  return reply({ provider, model, keyHint: keyHint(key) });
}

export async function DELETE(req: Request) {
  const who = await signedIn(req);
  if (who.error) return who.error;
  if (who.user) await clearChoice(who.user.id);
  return reply({ provider: "groq" });
}
