/**
 * USD per 1M tokens, per model. Unknown models fall back to AI_PRICE_INPUT_PER_1M /
 * AI_PRICE_OUTPUT_PER_1M (default: the gpt-4o rates).
 * Claude Haiku 5.5 is priced by prompt size: up to 100K input tokens, then a higher tier.
 */
const MODEL_PRICES = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longInput: 0.5, longOutput: 2.5, longAbove: 100_000 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "gpt-4o": { input: 2.5, output: 10 },
};
const DEFAULT_INPUT_PER_1M = 2.5;
const DEFAULT_OUTPUT_PER_1M = 10;

function envNum(key, fallback) {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Dated snapshots ("gpt-4o-2024-08-06") price like their base model. */
function priceFor(model) {
  const name = String(model || "");
  const key = Object.keys(MODEL_PRICES).find((k) => name === k || name.startsWith(`${k}-`));
  return key
    ? { model: key, ...MODEL_PRICES[key] }
    : {
        model: name || "unknown",
        input: envNum("AI_PRICE_INPUT_PER_1M", DEFAULT_INPUT_PER_1M),
        output: envNum("AI_PRICE_OUTPUT_PER_1M", DEFAULT_OUTPUT_PER_1M),
      };
}

export function estimateOpenAiCostUsd(model, promptTokens, completionTokens) {
  const price = priceFor(model);
  const prompt = Math.max(0, Number(promptTokens) || 0);
  const completion = Math.max(0, Number(completionTokens) || 0);
  const long = price.longAbove != null && prompt > price.longAbove;
  const cost =
    (prompt / 1_000_000) * (long ? price.longInput : price.input) +
    (completion / 1_000_000) * (long ? price.longOutput : price.output);
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Rates for the model role matching runs on, shown on the admin overview. */
export function pricingMeta() {
  const price = priceFor(process.env.AI_MATCH_MODEL || "gpt-4o");
  return {
    model: price.model,
    inputPer1M: price.input,
    outputPer1M: price.output,
    note: "Estimated from token counts at each model's list price; historical calls before tracking are not included.",
  };
}
