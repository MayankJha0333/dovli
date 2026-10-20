import { describe, expect, it } from "vitest";
import { AIProviderError, PROVIDERS, buildRequest, callAI, streamAI, checkKey, cleanModel, explainError, keyHint, openKey, parseResponse, sealKey, sealingKey } from "./aiCore";

const base = { apiKey: "secret-key-1234567890abcd", system: "Be brief.", prompt: "Hi", maxTokens: 500 };

describe("building requests", () => {
  it("talks to Groq in the OpenAI format, with a little thinking for GPT-OSS", () => {
    const r = buildRequest({ ...base, provider: "groq", model: "openai/gpt-oss-120b" });
    expect(r.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(r.headers.authorization).toBe(`Bearer ${base.apiKey}`);
    const body = r.body as any;
    expect(body.messages[0]).toEqual({ role: "system", content: "Be brief." });
    expect(body.reasoning_effort).toBe("low");
    expect(body.include_reasoning).toBe(false);
    expect(body.max_completion_tokens).toBeGreaterThan(500);
  });
  it("sends no thinking settings to models that don't think", () => {
    const body = buildRequest({ ...base, provider: "groq", model: "llama-3.3-70b-versatile" }).body as any;
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.max_completion_tokens).toBe(500);
  });
  it("talks to Anthropic's Messages API", () => {
    const r = buildRequest({ ...base, provider: "anthropic", model: "claude-haiku-5-5" });
    expect(r.url).toBe("https://api.anthropic.com/v1/messages");
    expect(r.headers["x-api-key"]).toBe(base.apiKey);
    expect(r.body).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 500, system: "Be brief." });
  });
  it("talks to OpenAI, without Groq-only settings", () => {
    const r = buildRequest({ ...base, provider: "openai", model: "gpt-6-luna" });
    expect(r.url).toBe("https://api.openai.com/v1/chat/completions");
    const body = r.body as any;
    expect(body.reasoning_effort).toBe("low");
    expect(body.include_reasoning).toBeUndefined();
  });
});

describe("conversations and JSON", () => {
  it("sends a whole conversation, and asks for JSON where the API can", () => {
    const messages = [
      { role: "user" as const, content: "Hi" },
      { role: "assistant" as const, content: "Hello" },
      { role: "user" as const, content: "Tidy this page" },
    ];
    const groq = buildRequest({ ...base, prompt: undefined, messages, json: true, provider: "groq", model: "openai/gpt-oss-120b" }).body as any;
    expect(groq.messages).toHaveLength(4);
    expect(groq.messages[3]).toEqual({ role: "user", content: "Tidy this page" });
    expect(groq.response_format).toEqual({ type: "json_object" });
    const claude = buildRequest({ ...base, prompt: undefined, messages, json: true, provider: "anthropic", model: "claude-haiku-5-5" }).body as any;
    expect(claude.messages).toHaveLength(3);
    expect(claude.response_format).toBeUndefined();
  });
});

describe("reading answers", () => {
  it("reads Anthropic text blocks and token counts", () => {
    const out = parseResponse("anthropic", { content: [{ type: "text", text: "Hello " }, { type: "text", text: "there" }], usage: { input_tokens: 3, output_tokens: 2 } });
    expect(out).toEqual({ text: "Hello there", inputTokens: 3, outputTokens: 2 });
  });
  it("reads Chat Completions answers", () => {
    const out = parseResponse("groq", { choices: [{ message: { content: " Done. " } }], usage: { prompt_tokens: 5, completion_tokens: 1 } });
    expect(out).toEqual({ text: "Done.", inputTokens: 5, outputTokens: 1 });
  });
});

describe("explaining failures", () => {
  it("blames the person's key only when it's their key", () => {
    expect(explainError("openai", 401, {}).message).toMatch(/didn't accept that API key/);
    expect(explainError("openai", 401, {}).status).toBe(400);
    expect(explainError("groq", 401, {}).message).toMatch(/Dovli AI isn't available/);
  });
  it("spots a missing model, an empty account and a busy service", () => {
    expect(explainError("anthropic", 404, {}).kind).toBe("model");
    expect(explainError("openai", 429, { error: { message: "You exceeded your current quota, check billing" } }).kind).toBe("quota");
    expect(explainError("groq", 429, { error: { message: "Rate limit reached" } }).kind).toBe("busy");
    expect(explainError("anthropic", 529, {}).kind).toBe("busy");
  });
  it("says when one request is too big for the account", () => {
    const groq = explainError("groq", 413, { error: { message: "Request too large for model `openai/gpt-oss-120b` … tokens per minute (TPM): Limit 8000" } });
    expect(groq.status).toBe(413);
    expect(groq.message).toMatch(/more text than Dovli AI can take at once.*connect your own AI key/);
    expect(explainError("groqcloud", 413, {}).message).toBe("That's more text than Groq can take at once. Try something shorter.");
  });
});

describe("making a call", () => {
  const fake = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it("returns the answer", async () => {
    const out = await callAI({ ...base, provider: "groq", model: "x" }, { fetchImpl: fake(200, { choices: [{ message: { content: "ok" } }] }) });
    expect(out.text).toBe("ok");
  });
  it("turns errors into plain words", async () => {
    await expect(callAI({ ...base, provider: "anthropic", model: "x" }, { fetchImpl: fake(401, {}) })).rejects.toBeInstanceOf(AIProviderError);
  });
  it("treats an empty answer as a failure, except when only checking a key", async () => {
    const empty = fake(200, { choices: [{ message: { content: "" } }] });
    await expect(callAI({ ...base, provider: "openai", model: "x" }, { fetchImpl: empty })).rejects.toThrow(/empty/);
    await expect(callAI({ ...base, provider: "openai", model: "x" }, { fetchImpl: empty, allowEmpty: true })).resolves.toMatchObject({ text: "" });
  });
  it("says so when the provider can't be reached", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(callAI({ ...base, provider: "openai", model: "x" }, { fetchImpl: down })).rejects.toMatchObject({ kind: "network" });
  });
});

describe("checking pasted keys", () => {
  it("accepts keys of the right shape", () => {
    expect(checkKey("anthropic", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz")).toBeNull();
    expect(checkKey("openai", "sk-proj-abcdefghijklmnopqrstuvwxyz")).toBeNull();
  });
  it("catches common mistakes", () => {
    expect(checkKey("anthropic", "")).toMatch(/Paste/);
    expect(checkKey("anthropic", "sk-proj-abcdefghijklmnopqrstuvwxyz")).toMatch(/start with/);
    expect(checkKey("openai", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz")).toMatch(/Anthropic key/);
    expect(checkKey("openai", "sk-has a space in it 1234567890")).toMatch(/doesn't look like/);
  });
  it("falls back to the default model for junk", () => {
    expect(cleanModel("openai", "gpt-6-sol")).toBe("gpt-6-sol");
    expect(cleanModel("openai", "<script>")).toBe(PROVIDERS.openai.defaultModel);
    expect(cleanModel("anthropic", undefined)).toBe(PROVIDERS.anthropic.defaultModel);
  });
});

describe("sealing keys", () => {
  const k = sealingKey("a-long-server-secret-that-is-at-least-32-characters");
  it("opens what it sealed, and nothing else", () => {
    const sealed = sealKey("sk-ant-real-key", k);
    expect(sealed).not.toContain("sk-ant");
    expect(openKey(sealed, k)).toBe("sk-ant-real-key");
    expect(openKey(sealed, sealingKey("a-different-secret-that-is-also-32-characters"))).toBeNull();
    expect(openKey(sealed.slice(0, -2) + "AA", k)).toBeNull();
    expect(openKey("junk", k)).toBeNull();
  });
  it("seals the same key differently each time", () => {
    expect(sealKey("same", k)).not.toBe(sealKey("same", k));
  });
  it("shows only the last 4 characters", () => {
    expect(keyHint("sk-ant-abcdef1234")).toBe("1234");
  });
});

describe("streaming an answer", () => {
  const sse = (events: string[], status = 200) =>
    (async (_url: string, init: any) => {
      (sse as any).lastBody = JSON.parse(init.body);
      const enc = new TextEncoder();
      const body = new ReadableStream({
        start(c) {
          // Split mid-line on purpose: lines can arrive in pieces.
          const all = events.map((e) => `data: ${e}\n\n`).join("");
          c.enqueue(enc.encode(all.slice(0, 25)));
          c.enqueue(enc.encode(all.slice(25)));
          c.close();
        },
      });
      return new Response(body, { status });
    }) as unknown as typeof fetch;

  it("passes on Groq/OpenAI pieces as they come, with the token counts", async () => {
    const got: string[] = [];
    const out = await streamAI(
      { ...base, provider: "groq", model: "openai/gpt-oss-120b", json: true },
      (t) => got.push(t),
      {
        fetchImpl: sse([
          JSON.stringify({ choices: [{ delta: { content: "Hel" } }] }),
          JSON.stringify({ choices: [{ delta: { content: "lo" } }], x_groq: { usage: { prompt_tokens: 9, completion_tokens: 2 } } }),
          "[DONE]",
        ]),
      },
    );
    expect(got).toEqual(["Hel", "lo"]);
    expect(out).toEqual({ text: "Hello", inputTokens: 9, outputTokens: 2 });
    expect((sse as any).lastBody.stream).toBe(true);
    expect((sse as any).lastBody.response_format).toBeUndefined();
  });

  it("reads Anthropic's events", async () => {
    const out = await streamAI({ ...base, provider: "anthropic", model: "claude-haiku-5-5" }, () => {}, {
      fetchImpl: sse([
        JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 7 } } }),
        JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } }),
        JSON.stringify({ type: "message_delta", usage: { output_tokens: 1 } }),
      ]),
    });
    expect(out).toEqual({ text: "Hi", inputTokens: 7, outputTokens: 1 });
  });

  it("turns errors, before or during the answer, into plain words", async () => {
    const refused = (async () => new Response(JSON.stringify({}), { status: 401 })) as unknown as typeof fetch;
    await expect(streamAI({ ...base, provider: "openai", model: "x" }, () => {}, { fetchImpl: refused })).rejects.toMatchObject({ kind: "key" });
    await expect(
      streamAI({ ...base, provider: "anthropic", model: "x" }, () => {}, { fetchImpl: sse([JSON.stringify({ type: "error", error: { type: "overloaded_error" } })]) }),
    ).rejects.toMatchObject({ kind: "busy" });
  });
});

describe("Groq and OpenRouter on your own key", () => {
  it("sends your Groq key to Groq, like Dovli AI", () => {
    const r = buildRequest({ ...base, provider: "groqcloud", model: "openai/gpt-oss-120b" });
    expect(r.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((r.body as any).include_reasoning).toBe(false);
  });
  it("talks to OpenRouter, with a small thinking budget only for thinking models", () => {
    const r = buildRequest({ ...base, provider: "openrouter", model: "anthropic/claude-haiku-5.5" });
    expect(r.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(r.headers["x-title"]).toBe("Dovli");
    expect(r.body).toMatchObject({ model: "anthropic/claude-haiku-5.5", max_tokens: 500 });
    expect((r.body as any).reasoning).toBeUndefined();
    const thinking = buildRequest({ ...base, provider: "openrouter", model: "openai/gpt-oss-120b" }).body as any;
    expect(thinking.reasoning).toEqual({ effort: "low", exclude: true });
    expect(thinking.max_tokens).toBeGreaterThan(500);
  });
  it("says so when an OpenRouter or Groq account is out of credit", () => {
    expect(explainError("openrouter", 402, {})).toMatchObject({ kind: "quota", status: 402 });
    expect(explainError("openrouter", 402, {}).message).toMatch(/OpenRouter account is out of credit/);
    expect(explainError("groqcloud", 401, {}).message).toMatch(/Groq didn't accept that API key/);
  });
  it("spots a key pasted under the wrong provider", () => {
    expect(checkKey("openrouter", "sk-or-v1-abcdefghijklmnopqrstuvwxyz")).toBeNull();
    expect(checkKey("groqcloud", "gsk_abcdefghijklmnopqrstuvwxyz1234")).toBeNull();
    expect(checkKey("openai", "sk-or-v1-abcdefghijklmnopqrstuvwxyz")).toMatch(/OpenRouter key/);
    expect(checkKey("groqcloud", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz")).toMatch(/Anthropic key/);
    expect(checkKey("openrouter", "sk-proj-abcdefghijklmnopqrstuvwxyz")).toMatch(/start with “sk-or-”/);
  });
  it("accepts OpenRouter's model ids, free and alias ones too", () => {
    expect(cleanModel("openrouter", "nvidia/nemotron-3.5-super-vl:free")).toBe("nvidia/nemotron-3.5-super-vl:free");
    expect(cleanModel("openrouter", "~deepseek/deepseek-pro-latest")).toBe("~deepseek/deepseek-pro-latest");
  });
});
