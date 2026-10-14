import RefreshToken from "../models/RefreshToken.js";
import SecurityEvent from "../models/SecurityEvent.js";

const clean = (value, max) =>
  typeof value === "string"
    ? value
        .replace(/[\x00-\x1f\x7f]/g, "")
        .trim()
        .toLowerCase()
        .slice(0, max)
    : "";

/** The in-app browser a visit came from, read from its user agent. */
export function platformFromUserAgent(ua = "") {
  if (/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)) return "tiktok";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return "facebook";
  if (/WhatsApp/i.test(ua)) return "whatsapp";
  return ua ? "browser" : "";
}

/** One stable source name: UTM tag first, then the in-app browser, then the referring site. */
export function normalizeSource({ utmSource = "", referrer = "", platform = "" } = {}) {
  const tag = clean(utmSource, 40);
  if (tag) {
    if (/tik ?tok|^tt$/.test(tag)) return "tiktok";
    if (/insta|^ig$/.test(tag)) return "instagram";
    if (/facebook|^fb$|^meta/.test(tag)) return "facebook";
    if (/google/.test(tag)) return "google";
    if (/whats|^wa$/.test(tag)) return "whatsapp";
    if (/youtube|^yt$/.test(tag)) return "youtube";
    return tag.replace(/[^a-z0-9_.-]/g, "").slice(0, 30) || "other";
  }
  if (["tiktok", "instagram", "facebook"].includes(platform)) return platform;
  const host = clean(referrer, 120).replace(/^www\./, "");
  if (host) {
    if (/tiktok\./.test(host)) return "tiktok";
    if (/instagram\./.test(host)) return "instagram";
    if (/facebook\.|^fb\.|^m\.me|messenger\./.test(host)) return "facebook";
    if (/google\./.test(host)) return "google";
    if (/^t\.co$|twitter\.|^x\.com/.test(host)) return "x";
    if (/youtube\.|youtu\.be/.test(host)) return "youtube";
    if (/whatsapp\.|^wa\.me/.test(host)) return "whatsapp";
    if (!/kachkivun\.com$/.test(host)) return "referral";
  }
  if (platform === "whatsapp") return "whatsapp";
  return "direct";
}

/** Sanitized attribution record from what the browser sent plus the request's own user agent. */
export function buildAttribution(body = {}, userAgent = "", { afterSignup = false } = {}) {
  const platform = platformFromUserAgent(userAgent);
  const referrer = clean(body.referrer, 120).replace(/^www\./, "");
  return {
    source: normalizeSource({ utmSource: body.utmSource, referrer, platform }),
    medium: clean(body.utmMedium, 40),
    campaign: clean(body.utmCampaign, 80),
    referrer,
    platform,
    landingPath: clean(body.landingPath, 120).split("?")[0],
    at: new Date(),
    afterSignup,
  };
}

/**
 * Source per user: the stored attribution, or (for users from before it was recorded) an estimate
 * from the earliest session or security event user agent still on file. Sessions expire, so older
 * users without either come back as "unknown".
 */
export async function sourcesForUsers(users) {
  const result = new Map();
  const missing = [];
  for (const u of users) {
    if (u.attribution?.source) result.set(String(u._id), { source: u.attribution.source, estimated: Boolean(u.attribution.afterSignup) });
    else missing.push(u._id);
  }
  if (missing.length) {
    const earliest = (Model) =>
      Model.aggregate([
        { $match: { userId: { $in: missing }, userAgent: { $nin: [null, ""] } } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: "$userId", ua: { $first: "$userAgent" }, at: { $first: "$createdAt" } } },
      ]);
    const [tokens, events] = await Promise.all([earliest(RefreshToken), earliest(SecurityEvent)]);
    const first = new Map();
    for (const row of [...tokens, ...events]) {
      const id = String(row._id);
      if (!first.has(id) || row.at < first.get(id).at) first.set(id, row);
    }
    for (const id of missing.map(String)) {
      const platform = platformFromUserAgent(first.get(id)?.ua || "");
      result.set(id, {
        source: platform && platform !== "browser" ? platform : platform === "browser" ? "browser" : "unknown",
        estimated: true,
      });
    }
  }
  return result;
}
