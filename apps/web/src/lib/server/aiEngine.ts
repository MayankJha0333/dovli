import "server-only";

// Which AI answers a request, and the monthly Dovli AI allowance. Shared by the writing help
// (/api/ai) and the assistant (/api/ai/assistant).
//
// Dovli AI runs on Groq with the server's key (GROQ_KEY). An older setup with only
// ANTHROPIC_API_KEY keeps working as Dovli AI too. People's own keys are never limited by the
// monthly allowance: their provider bills them directly.

import { FieldValue } from "firebase-admin/firestore";
import { adminDb, firebaseOnServer, type RequestUser } from "./firebaseAdmin";
import { PROVIDERS, type ProviderId } from "./aiCore";
import { choiceFromHeaders, loadChoice } from "./aiKeys";

export const LIMIT = Number(process.env.AI_MONTHLY_TOKENS || 200_000);

export interface Engine {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

/** Dovli AI: Groq by default, or the older Anthropic server key. Null when neither is set. */
export const builtIn: Engine | null = (() => {
  const groq = process.env.GROQ_KEY || process.env.GROQ_API_KEY;
  if (groq) return { provider: "groq", apiKey: groq, model: process.env.GROQ_MODEL || PROVIDERS.groq.defaultModel };
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { provider: "anthropic", apiKey: anthropic, model: process.env.AI_MODEL || PROVIDERS.anthropic.defaultModel };
  return null;
})();

export const month = () => new Date().toISOString().slice(0, 7);

// With accounts turned on, each person's monthly use is counted in Firestore: aiUsage/{uid}_{month}.
const usageDoc = (userId: string) => adminDb()!.collection("aiUsage").doc(`${userId}_${month()}`);

export async function usedThisMonth(userId: string | null): Promise<number | null> {
  if (!adminDb() || !userId) return null;
  const snap = await usageDoc(userId).get();
  return (snap.data()?.tokens as number) ?? 0;
}

export async function addUsage(userId: string, tokens: number): Promise<number | null> {
  if (!adminDb()) return null;
  const ref = usageDoc(userId);
  await ref.set({ userId, month: month(), tokens: FieldValue.increment(tokens), updatedAt: new Date() }, { merge: true });
  return ((await ref.get()).data()?.tokens as number) ?? null;
}

/** The person's own key, if they connected one: from their account, or (without accounts) from this request. */
export async function ownChoice(req: Request, user: RequestUser | null) {
  if (firebaseOnServer) return user ? await loadChoice(user.id).catch(() => null) : null;
  return choiceFromHeaders(req);
}

/** The AI to use for this person: their own key, else Dovli AI. `own` says which. */
export async function engineFor(req: Request, user: RequestUser | null): Promise<{ engine: Engine | null; own: boolean }> {
  const mine = await ownChoice(req, user);
  if (mine?.apiKey) return { engine: { provider: mine.provider, apiKey: mine.apiKey, model: mine.model }, own: true };
  return { engine: builtIn, own: false };
}
