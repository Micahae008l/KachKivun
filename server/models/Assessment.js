import mongoose from "mongoose";
import { YOM_HAMEAH_12_KEYS } from "../utils/yomHameah12Keys.js";
import {
  ASSESSMENT_SCHEMA_VERSIONS,
  COMBAT_PREFERENCES,
  COMBAT_READINESS,
  DAPAR_SCORES,
  ENVIRONMENTS,
  EXIT_PREFERENCES,
  FITNESS_LEVELS,
  FOCUS_PREFERENCES,
  GENDERS,
  LEADERSHIP_PREFERENCES,
  MEDICAL_PROFILES,
  MOTIVATIONS,
  PULL_UP_BANDS,
  PUSH_UP_BANDS,
  ROLE_AVOIDANCES,
  ROLE_INTERESTS,
  RUN_3KM_BANDS,
  SERVICE_LIFE_CYCLES,
  STRESS_PREFERENCES,
  TECHNICAL_AREAS,
  TECHNICAL_LEVELS,
  UNKNOWN_ASSESSMENT_VALUE,
  YOM_SOURCES,
} from "../utils/assessmentValues.js";

const enumArray = (values, max) => ({
  type: [{ type: String, enum: values }],
  default: [],
  validate: {
    validator: (items) => Array.isArray(items) && items.length <= max,
    message: `array cannot contain more than ${max} values`,
  },
});

const thresholdAnswer = (values, label) => ({
  type: mongoose.Schema.Types.Mixed,
  required: true,
  validate: {
    validator: (value) =>
      value === UNKNOWN_ASSESSMENT_VALUE || values.includes(value),
    message: `${label} must be an allowed score or explicit unknown`,
  },
});

const yomShape = Object.fromEntries(
  YOM_HAMEAH_12_KEYS.map((key) => [key, { type: Number, min: 1, max: 5, required: true }]),
);

const combatDetailsSchema = new mongoose.Schema(
  {
    run3kmBand: { type: String, enum: RUN_3KM_BANDS, required: true },
    pullUpsBand: { type: String, enum: PULL_UP_BANDS, required: true },
    pushUpsBand: { type: String, enum: PUSH_UP_BANDS, required: true },
    readiness: { type: String, enum: COMBAT_READINESS, required: true },
  },
  { _id: false },
);

const technicalDetailsSchema = new mongoose.Schema(
  {
    level: { type: String, enum: TECHNICAL_LEVELS, required: true },
    areas: {
      ...enumArray(TECHNICAL_AREAS, 4),
      validate: [
        enumArray(TECHNICAL_AREAS, 4).validate,
        {
          validator: (items) => Array.isArray(items) && items.length > 0,
          message: "at least one technical area is required",
        },
      ],
    },
  },
  { _id: false },
);

const answersSchema = new mongoose.Schema(
  {
    serviceLifeCycle: { type: String, enum: SERVICE_LIFE_CYCLES, required: true },
    preferredName: { type: String, trim: true, minlength: 1, maxlength: 120, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    daparScore: thresholdAnswer(DAPAR_SCORES, "daparScore"),
    medicalProfile: thresholdAnswer(MEDICAL_PROFILES, "medicalProfile"),
    draftDate: { type: Date, required: true },
    yomHameah: { type: new mongoose.Schema(yomShape, { _id: false }), required: true },
    yomHameahSource: { type: String, enum: YOM_SOURCES, required: true },
    combatPreference: { type: String, enum: COMBAT_PREFERENCES, required: true },
    focus: { type: String, enum: FOCUS_PREFERENCES, required: true },
    physicalActivityLevel: { type: String, enum: FITNESS_LEVELS, required: true },
    rolesInterested: {
      ...enumArray(ROLE_INTERESTS, 5),
      validate: [
        enumArray(ROLE_INTERESTS, 5).validate,
        {
          validator: (items) => Array.isArray(items) && items.length > 0,
          message: "at least one role interest is required",
        },
      ],
    },
    rolesAvoided: enumArray(ROLE_AVOIDANCES, 6),
    exitsPreference: { type: String, enum: EXIT_PREFERENCES, required: true },
    environment: { type: String, enum: ENVIRONMENTS, required: true },
    leadership: { type: String, enum: LEADERSHIP_PREFERENCES, required: true },
    stress: { type: String, enum: STRESS_PREFERENCES, required: true },
    motivations: {
      ...enumArray(MOTIVATIONS, 4),
      validate: [
        enumArray(MOTIVATIONS, 4).validate,
        {
          validator: (items) => Array.isArray(items) && items.length > 0,
          message: "at least one motivation is required",
        },
      ],
    },
    combatDetails: { type: combatDetailsSchema, default: null },
    technicalDetails: { type: technicalDetailsSchema, default: null },
    extraNote: { type: String, trim: true, maxlength: 400, default: "" }, // personal request to the counselor
  },
  { _id: false },
);

const assessmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    schemaVersion: {
      type: Number,
      enum: ASSESSMENT_SCHEMA_VERSIONS,
      required: true,
    },
    clientDraftId: {
      type: String,
      trim: true,
      minlength: 8,
      maxlength: 80,
      required: true,
    },
    sourceRoute: {
      type: String,
      enum: ["post-signup"],
      default: "post-signup",
      required: true,
    },
    branches: {
      wantsCombat: { type: Boolean, required: true },
      wantsTechnical: { type: Boolean, required: true },
    },
    answers: { type: answersSchema, required: true },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

assessmentSchema.index({ userId: 1, completedAt: -1 });
assessmentSchema.index({ userId: 1, clientDraftId: 1 }, { unique: true });

export default mongoose.model("Assessment", assessmentSchema);
