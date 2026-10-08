import mongoose from "mongoose";

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      enum: ["paywall_launch_at"],
    },
    dateValue: {
      type: Date,
      required: true,
      immutable: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("SystemConfig", systemConfigSchema);
