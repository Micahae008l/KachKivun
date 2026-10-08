import mongoose from "mongoose";

const militaryStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    draftDate: { type: Date, default: null },
    dischargeDate: { type: Date, default: null },
    serviceStartDate: { type: Date, default: null },
    serviceEndDate: { type: Date, default: null },
    yomQuestionnaire: {
      type: [
        {
          questionId: { type: String, required: true },
          score: { type: Number, min: 1, max: 5, required: true },
        },
      ],
      default: [],
    },
    daparScore: {
      type: Number,
      enum: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      default: null,
    },
    medicalProfile: {
      type: Number,
      enum: [21, 45, 64, 72, 82, 97],
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: null,
    },
    /** Mixed: 12 ממדי מא״ה (או מבנה ישן של 5) — Mixed כדי שלא יוסרו שדות בטעינה ממונגו. */
    yomHameah: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("MilitaryStats", militaryStatsSchema);
