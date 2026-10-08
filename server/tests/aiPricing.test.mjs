import test from "node:test";
import assert from "node:assert/strict";
import { estimateOpenAiCostUsd } from "../utils/openaiPricing.js";

test("Haiku 5.5 is priced at its own rates, not gpt-4o's", () => {
  // 46,087 in at $0.10/M + 6,166 out at $0.50/M
  assert.equal(estimateOpenAiCostUsd("claude-haiku-5-5", 46_087, 6_166), 0.007692);
});

test("Haiku 5.5 prompts over 100K use the higher tier", () => {
  assert.equal(estimateOpenAiCostUsd("claude-haiku-5-5", 200_000, 10_000), 0.125);
});

test("dated gpt-4o snapshots keep gpt-4o pricing", () => {
  assert.equal(estimateOpenAiCostUsd("gpt-4o-2024-08-06", 3_164, 699), 0.0149);
});
