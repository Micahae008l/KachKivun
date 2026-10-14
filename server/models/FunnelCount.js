import mongoose from "mongoose";

/**
 * Anonymous funnel counter: how many browser sessions reached each step on a given Israel-time
 * day. No user, cookie or IP is stored, only the step name, the day and a number.
 */
const funnelCountSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    step: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { versionKey: false },
);
funnelCountSchema.index({ day: 1, step: 1 }, { unique: true });

export default mongoose.model("FunnelCount", funnelCountSchema);
