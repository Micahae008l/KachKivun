import fs from "node:fs";
import { getRecommendationAccessForUser } from "../utils/recommendationAccess.js";
import { sendServerError } from "../utils/httpError.js";

let cached = null;
function loadContent() {
  cached ??= JSON.parse(
    fs.readFileSync(new URL("../data/gibush-content.json", import.meta.url), "utf8"),
  );
  return cached;
}

/**
 * The gibush simulation content (moments, bars, ladders, plan text). Paid feature: unlocked by
 * the same purchase as the top recommendation places. `getAccess` is injectable for tests.
 */
export function createGibushContentHandler({ getAccess = getRecommendationAccessForUser } = {}) {
  return async function getGibushContent(req, res) {
    try {
      const access = await getAccess(req.userId);
      if (access.paywallEnabled && !access.topTwoUnlocked) {
        return res.status(403).json({ error: "התוכן נפתח אחרי הרכישה", code: "GIBUSH_LOCKED" });
      }
      res.set("Cache-Control", "private, no-store");
      res.json(loadContent());
    } catch (err) {
      return sendServerError(res, err, "[gibush/content]");
    }
  };
}

export const getGibushContent = createGibushContentHandler();
