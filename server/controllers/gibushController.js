import fs from "node:fs";
import { sendServerError } from "../utils/httpError.js";

let cached = null;
function loadContent() {
  cached ??= JSON.parse(
    fs.readFileSync(new URL("../data/gibush-content.json", import.meta.url), "utf8"),
  );
  return cached;
}

/** The gibush simulation content (moments, bars, ladders, plan text). Free and public. */
export function getGibushContent(_req, res) {
  try {
    res.set("Cache-Control", "public, max-age=600");
    res.json(loadContent());
  } catch (err) {
    return sendServerError(res, err, "[gibush/content]");
  }
}
