import FunnelCount from "../models/FunnelCount.js";
import { israelDay, parseFunnelStep } from "../utils/funnel.js";
import { sendServerError } from "../utils/httpError.js";

export async function recordFunnelStep(req, res) {
  try {
    const step = parseFunnelStep(req.body);
    if (!step) return res.status(400).json({ error: "Invalid step", code: "VALIDATION_ERROR" });
    await FunnelCount.updateOne({ day: israelDay(), step }, { $inc: { count: 1 } }, { upsert: true });
    return res.status(204).end();
  } catch (err) {
    return sendServerError(res, err, "[metrics/funnel]");
  }
}
