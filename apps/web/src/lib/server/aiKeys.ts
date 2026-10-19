import "server-only";

// Each person's AI choice, kept in Firestore at aiSettings/{uid} (the app can't read this
// collection; only the server can, see firestore.rules). Their own API key is stored sealed
// (AES-256-GCM, see aiCore.ts) and never leaves the server again: the app only ever sees the
// provider, the model and the key's last 4 characters.

import { adminDb } from "./firebaseAdmin";
import { PROVIDERS, cleanModel, dovliModel, isOwnProvider, keyHint, openKey, sealKey, sealingKey, type OwnProviderId, type ProviderId } from "./aiCore";

const secret = process.env.AI_KEYS_SECRET || process.env.AUTH_CODE_SECRET || "";
/** People can store their own keys only when the server has a secret to seal them with, and a database. */
export const canStoreKeys = () => secret.length >= 32 && !!adminDb();

let sealing: Buffer | null = null;
const sealer = () => (sealing ??= sealingKey(secret));

/** What the app is told about someone's AI setup. */
export interface AIChoice {
  /** groq = Dovli AI (the default). */
  provider: ProviderId;
  model: string;
  /** The connected key's last 4 characters, for their own provider. */
  keyHint?: string;
}

/** Either their own key (sealed), or just the Dovli AI model they picked (provider "groq", no key). */
interface Stored {
  provider: OwnProviderId | "groq";
  model: string;
  key?: string; // sealed
  keyHint?: string;
  updatedAt: Date;
}

const doc = (uid: string) => adminDb()!.collection("aiSettings").doc(uid);

/** Someone's setup, with their key opened for one call. Null means Dovli AI. */
export async function loadChoice(uid: string): Promise<(AIChoice & { apiKey?: string }) | null> {
  if (!canStoreKeys()) return null;
  const d = (await doc(uid).get()).data() as Stored | undefined;
  if (d?.provider === "groq") {
    const model = dovliModel(d.model);
    return model ? { provider: "groq", model } : null;
  }
  if (!d || !isOwnProvider(d.provider) || !d.key) return null;
  const apiKey = openKey(d.key, sealer());
  // A key sealed with an old secret can't be opened: treat it as not connected.
  if (!apiKey) return null;
  return { provider: d.provider, model: cleanModel(d.provider, d.model), keyHint: d.keyHint, apiKey };
}

export async function saveChoice(uid: string, provider: OwnProviderId, model: string, apiKey: string) {
  const stored: Stored = { provider, model: cleanModel(provider, model), key: sealKey(apiKey, sealer()), keyHint: keyHint(apiKey), updatedAt: new Date() };
  await doc(uid).set(stored);
}

/** Change only the model of a connected key. */
export async function saveModel(uid: string, model: string) {
  const d = (await doc(uid).get()).data() as Stored | undefined;
  if (!d || d.provider === "groq") return;
  await doc(uid).update({ model: cleanModel(d.provider, model), updatedAt: new Date() });
}

/** Use Dovli AI with this model (one from its own list). Replaces a connected key. */
export async function saveDovliModel(uid: string, model: string) {
  const stored: Stored = { provider: "groq", model, updatedAt: new Date() };
  await doc(uid).set(stored);
}

export async function clearChoice(uid: string) {
  await doc(uid).delete();
}

/** Without accounts, Dovli runs on one device: the key travels with each request instead. */
export function choiceFromHeaders(req: Request): (AIChoice & { apiKey?: string }) | null {
  const provider = req.headers.get("x-dovli-ai-provider");
  const apiKey = req.headers.get("x-dovli-ai-key")?.trim();
  if (provider === "groq") {
    const model = dovliModel(req.headers.get("x-dovli-ai-model"));
    return model ? { provider: "groq", model } : null;
  }
  if (!isOwnProvider(provider) || !apiKey) return null;
  return { provider, model: cleanModel(provider, req.headers.get("x-dovli-ai-model")), keyHint: keyHint(apiKey), apiKey };
}

export const providerName = (p: ProviderId) => PROVIDERS[p].name;
