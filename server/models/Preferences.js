import mongoose from "mongoose";
import { ENVIRONMENTS, LANGUAGES, MOTIVATIONS, STRENGTHS } from "../utils/personalSignals.js";

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
      enum: ["official", "self", "unspecified"],
      default: "unspecified",
    },
    // Personal signup answers (utils/personalSignals.js); optional, feed the AI match.
    motivation: { type: String, enum: [...Object.keys(MOTIVATIONS), null], default: null },
    strengths: { type: String, enum: [...Object.keys(STRENGTHS), null], default: null },
    environment: { type: String, enum: [...Object.keys(ENVIRONMENTS), null], default: null },
    languages: { type: [{ type: String, enum: Object.keys(LANGUAGES) }], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Preferences", preferencesSchema);
