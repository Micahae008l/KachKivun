import { useEffect } from "react";
import { ASSESSMENT_DRAFT_VERSION, saveAssessmentDraft, type AssessmentDraft } from "./draft";
import { ASSESSMENT_SCHEMA_VERSION, type AssessmentAnswers, type AssessmentStepId } from "./types";

type DraftState = {
  enabled: boolean;
  clientDraftId: string;
  currentStep: AssessmentStepId;
  email: string;
  answers: AssessmentAnswers;
};

/** Persist the complete assessment snapshot whenever an anonymous-flow field changes. */
export function useAssessmentDraft({
  enabled,
  clientDraftId,
  currentStep,
  email,
  answers,
}: DraftState) {
  useEffect(() => {
    if (!enabled || !clientDraftId) return;
    const draft: AssessmentDraft = {
      draftVersion: ASSESSMENT_DRAFT_VERSION,
      schemaVersion: ASSESSMENT_SCHEMA_VERSION,
      clientDraftId,
      currentStep,
      email: email.trim().toLowerCase(),
      answers,
      updatedAt: new Date().toISOString(),
    };
    saveAssessmentDraft(draft);
  }, [answers, clientDraftId, currentStep, email, enabled]);
}
