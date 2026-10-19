import { describe, expect, it } from "vitest";
import { groqModels, openRouterModels } from "./aiModels";

describe("live model lists", () => {
  it("keeps OpenRouter's text models, with price and context", () => {
    const got = openRouterModels({
      data: [
        { id: "anthropic/claude-sonnet-5.5", name: "Anthropic: Claude Sonnet 5.5", pricing: { prompt: "0.000003", completion: "0.000015" }, context_length: 1_000_000 },
        { id: "anthropic/claude-haiku-5.5", name: "Anthropic: Claude Haiku 5.5", pricing: { prompt: "0.0000001", completion: "0.0000005" } },
        { id: "nvidia/nemotron:free", name: "NVIDIA: Nemotron (free)", pricing: { prompt: "0", completion: "0" }, context_length: 131072 },
        { id: "openrouter/auto", name: "Auto Router", pricing: { prompt: "-1", completion: "-1" } },
        { id: "img/gen", name: "Image only", architecture: { input_modalities: ["text"], output_modalities: ["image"] } },
      ],
    });
    expect(got.map((m) => m.id)).toEqual(["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5", "openrouter/auto", "nvidia/nemotron:free"]);
    expect(got[0].hint).toBe("$0.1 in / $0.5 out per 1M tokens");
    expect(got[1].hint).toBe("$3 in / $15 out per 1M tokens · 1M context");
    expect(got[2].hint).toBe("Price varies");
    expect(got[3]).toMatchObject({ free: true, hint: "Free · 131K context" });
  });
  it("keeps Groq's chat models only", () => {
    const got = groqModels({
      data: [
        { id: "openai/gpt-oss-120b", owned_by: "OpenAI", context_window: 131072 },
        { id: "whisper-large-v3", owned_by: "OpenAI" },
        { id: "old-model", active: false },
      ],
    });
    expect(got).toEqual([{ id: "openai/gpt-oss-120b", label: "openai/gpt-oss-120b", hint: "OpenAI · 131K context" }]);
  });
  it("copes with nonsense", () => {
    expect(openRouterModels(null)).toEqual([]);
    expect(groqModels({ data: "x" })).toEqual([]);
  });
});
