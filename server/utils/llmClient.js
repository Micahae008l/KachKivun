import OpenAI from "openai";

/**
 * Single chat call that returns a JSON string, routed by model name:
 * `claude-*` → Anthropic Messages API (plain fetch, no SDK), anything else → OpenAI.
 * Both paths return the same shape so callers never branch on provider.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
let openaiClient = null;

export function isAnthropicModel(model) {
  return /^claude-/i.test(String(model || ""));
}

function stripFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function chatJson({ model, system, user, maxTokens = 8000, temperature = 0.1, seed }) {
  if (isAnthropicModel(model)) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const error = new Error("ANTHROPIC_API_KEY is missing");
      error.status = 401;
      throw error;
    }
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      // Claude 5.x models reject `temperature` ("deprecated for this model"), so it is not sent.
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const error = new Error(`Anthropic ${response.status}: ${body.slice(0, 300)}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    const content = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    return {
      content: stripFences(content),
      model: data.model || model,
      id: data.id ?? null,
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      finishReason: data.stop_reason === "max_tokens" ? "length" : (data.stop_reason ?? null),
    };
  }

  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const params = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    temperature,
  };
  if (seed != null) params.seed = seed;
  const completion = await openaiClient.chat.completions.create(params);
  const choice = completion.choices[0];
  return {
    content: choice?.message?.content?.trim() ?? "",
    model: completion.model || model,
    id: completion.id ?? null,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
    finishReason: choice?.finish_reason ?? null,
  };
}
