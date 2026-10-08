import { defaultYomHameah12Scores } from "@/lib/yom-hameah-12";
import type { AssessmentAnswers } from "./types";

export function createDefaultAssessmentAnswers(): AssessmentAnswers {
  return {
    serviceLifeCycle: "pre",
    preferredName: "",
    gender: "",
    daparScore: null,
    medicalProfile: null,
    draftDate: "",
    yomHameah: defaultYomHameah12Scores(),
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
