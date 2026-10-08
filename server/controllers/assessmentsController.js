import mongoose from "mongoose";
import Assessment from "../models/Assessment.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import User from "../models/User.js";
import { sendServerError } from "../utils/httpError.js";

function compatibilityPreferences(answers) {
  return {
    combatPreference: answers.combatPreference,
    focus: answers.focus,
    physicalActivityLevel: answers.physicalActivityLevel,
    schedule: answers.exitsPreference === "hamshushim" ? "Hamshushim" : "Any",
    location: answers.rolesAvoided.includes("far_from_home") ? "Close to home" : "Anywhere",
    yomHameahSource:
      answers.yomHameahSource === "unknown"
        ? "unknown"
        : answers.yomHameahSource,
  };
}

function compatibilityThreshold(value) {
  return value === "unknown" ? null : value;
}

function sessionOptions(session) {
  return session ? { session } : {};
}

async function persistCompletion(userId, payload, session = null) {
  const options = sessionOptions(session);
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        preferredName: payload.answers.preferredName,
        status: "Pre-Draft",
      },
    },
    { new: true, ...options },
  );
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  await MilitaryStats.findOneAndUpdate(
    { userId },
    {
      $set: {
        daparScore: compatibilityThreshold(payload.answers.daparScore),
        medicalProfile: compatibilityThreshold(payload.answers.medicalProfile),
        gender: payload.answers.gender,
        draftDate: new Date(`${payload.answers.draftDate}T00:00:00.000Z`),
        yomHameah: payload.answers.yomHameah,
        yomQuestionnaire: [],
      },
      $setOnInsert: { userId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, ...options },
  );

  await Preferences.findOneAndUpdate(
    { userId },
    {
      $set: compatibilityPreferences(payload.answers),
      $setOnInsert: { userId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, ...options },
  );

  const completedAt = new Date();
  return Assessment.findOneAndUpdate(
    { userId, clientDraftId: payload.clientDraftId },
    {
      $set: {
        schemaVersion: payload.schemaVersion,
        sourceRoute: "post-signup",
        branches: payload.branches,
        answers: payload.answers,
        completedAt,
      },
      $setOnInsert: {
        userId,
        clientDraftId: payload.clientDraftId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, ...options },
  );
}

function isStandaloneTransactionError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === 20 ||
    error?.codeName === "IllegalOperation" ||
    /transaction numbers are only allowed|replica set member or mongos|transactions are not supported/i.test(
      message,
    )
  );
}

function publicAnswers(rawAnswers) {
  const answers =
    rawAnswers && typeof rawAnswers.toObject === "function"
      ? rawAnswers.toObject()
      : { ...(rawAnswers || {}) };
  const draftDate = answers.draftDate ? new Date(answers.draftDate) : null;
  return {
    ...answers,
    draftDate:
      draftDate && !Number.isNaN(draftDate.getTime()) ? draftDate.toISOString().slice(0, 10) : "",
    combatDetails: answers.combatDetails ?? {
      run3kmBand: "",
      pullUpsBand: "",
      pushUpsBand: "",
      readiness: "",
    },
    technicalDetails: answers.technicalDetails ?? {
      level: "",
      areas: [],
    },
  };
}

function publicAssessment(doc) {
  return {
    id: String(doc._id),
    schemaVersion: doc.schemaVersion,
    clientDraftId: doc.clientDraftId,
    answers: publicAnswers(doc.answers),
    completedAt: doc.completedAt?.toISOString?.() ?? String(doc.completedAt),
    createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
    updatedAt: doc.updatedAt?.toISOString?.() ?? String(doc.updatedAt),
  };
}

export function canUseStandaloneAssessmentFallback(env = process.env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() !== "production";
}

export async function completeAssessment(req, res) {
  const userId = req.userId;
  let session;
  let transactionMode = "transaction";
  try {
    const existingUser = await User.exists({ _id: userId });
    if (!existingUser) return res.status(404).json({ error: "User not found" });

    session = await mongoose.startSession();
    let assessment;
    try {
      await session.withTransaction(async () => {
        assessment = await persistCompletion(userId, req.body, session);
      });
    } catch (error) {
      if (!isStandaloneTransactionError(error)) throw error;
      if (!canUseStandaloneAssessmentFallback()) throw error;
      transactionMode = "standalone-fallback";
      console.warn(
        "[assessments/complete] MongoDB transactions unavailable; using idempotent standalone writes.",
      );
      assessment = await persistCompletion(userId, req.body);
    }

    return res.status(201).json({
      assessmentId: String(assessment._id),
      schemaVersion: assessment.schemaVersion,
      completedAt: assessment.completedAt.toISOString(),
      transactionMode,
    });
  } catch (error) {
    if (error?.statusCode === 404) return res.status(404).json({ error: "User not found" });
    if (error?.code === 11000) {
      try {
        const assessment = await Assessment.findOne({
          userId,
          clientDraftId: req.body.clientDraftId,
        });
        if (assessment) {
          return res.status(200).json({
            assessmentId: String(assessment._id),
            schemaVersion: assessment.schemaVersion,
            completedAt: assessment.completedAt.toISOString(),
            transactionMode,
          });
        }
      } catch {
        // Fall through to the standard safe server error.
      }
    }
    return sendServerError(res, error, "[assessments/complete]");
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // Session cleanup must not replace a successful API response.
      }
    }
  }
}

export async function getLatestAssessment(req, res) {
  try {
    const assessment = await Assessment.findOne({ userId: req.userId })
      .sort({ completedAt: -1, _id: -1 })
      .lean();
    return res.json({ assessment: assessment ? publicAssessment(assessment) : null });
  } catch (error) {
    return sendServerError(res, error, "[assessments/latest]");
  }
}
