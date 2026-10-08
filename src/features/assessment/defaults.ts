import { defaultYomHameahScores } from "@/lib/yom-hameah";
import type { AssessmentAnswers } from "./types";

export function createDefaultAssessmentAnswers(): AssessmentAnswers {
  return {
    serviceLifeCycle: "pre",
    preferredName: "",
    gender: "",
    daparScore: null,
    medicalProfile: null,
    draftDate: "",
    yomHameah: defaultYomHameahScores(),
    yomHameahSource: "",
    combatPreference: "",
    focus: "",
    physicalActivityLevel: "",
    rolesInterested: [],
    rolesAvoided: [],
    exitsPreference: "",
    environment: "",
    leadership: "",
    stress: "",
    motivations: [],
    combatDetails: {
      run3kmBand: "",
      pullUpsBand: "",
      pushUpsBand: "",
      readiness: "",
    },
    technicalDetails: {
      level: "",
      areas: [],
    },
    extraNote: "",
  };
}
