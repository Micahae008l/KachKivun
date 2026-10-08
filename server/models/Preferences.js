import mongoose from "mongoose";

const preferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    combatPreference: {
      type: String,
      enum: [
        "Kravi",
        "Jobnik",
        "Undecided",
        "Mixed",
        "FieldCombat",
        "SupportHQ",
        "TechTrack",
        "MedicalInstruction",
      ],
      default: "Undecided",
    },
    schedule: {
      type: String,
      enum: ["Yomiyot", "Hamshushim", "Any"],
      default: "Any",
    },
    focus: {
      type: String,
      enum: ["Tech", "Physical", "Research", "Medical", "Any"],
      default: "Any",
    },
    location: {
      type: String,
      enum: ["Close to home", "Anywhere"],
      default: "Anywhere",
    },
    physicalActivityLevel: {
      type: String,
      enum: ["Low", "Medium", "High", "Unspecified"],
      default: "Unspecified",
    },
    yomHameahSource: {
      type: String,
      enum: ["official", "self", "unknown", "unspecified"],
      default: "unspecified",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Preferences", preferencesSchema);
