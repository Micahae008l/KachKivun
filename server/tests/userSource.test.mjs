import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttribution, normalizeSource, platformFromUserAgent } from "../utils/userSource.js";

const IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0";
const TT = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6";

test("in-app browsers are recognized from the user agent", () => {
  assert.equal(platformFromUserAgent(IG), "instagram");
  assert.equal(platformFromUserAgent(TT), "tiktok");
  assert.equal(platformFromUserAgent("Mozilla/5.0 Chrome/120"), "browser");
  assert.equal(platformFromUserAgent(""), "");
});

test("source: UTM tag first, then in-app browser, then referrer, else direct", () => {
  assert.equal(normalizeSource({ utmSource: "TikTok", platform: "instagram" }), "tiktok");
  assert.equal(normalizeSource({ utmSource: "ig" }), "instagram");
  assert.equal(normalizeSource({ platform: "tiktok", referrer: "google.com" }), "tiktok");
  assert.equal(normalizeSource({ referrer: "l.instagram.com" }), "instagram");
  assert.equal(normalizeSource({ referrer: "www.google.co.il" }), "google");
  assert.equal(normalizeSource({ referrer: "kachkivun.com" }), "direct");
  assert.equal(normalizeSource({}), "direct");
});

test("attribution is sanitized and keeps only the landing path", () => {
  const a = buildAttribution({ utmSource: "  TikTok\n", landingPath: "/?utm_source=x&email=a@b.c", referrer: "WWW.TIKTOK.COM" }, IG);
  assert.equal(a.source, "tiktok");
  assert.equal(a.platform, "instagram");
  assert.equal(a.landingPath, "/");
  assert.equal(a.referrer, "tiktok.com");
});
