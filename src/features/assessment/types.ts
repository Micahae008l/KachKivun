import type {
  CombatPreferenceValue,
  FitnessPreferenceValue,
  FocusPreferenceValue,
} from "@/lib/profile-preference-data";
import type { YomHameah } from "@/lib/yom-hameah-12";

export const ASSESSMENT_SCHEMA_VERSION = 2 as const;

export type Gender = "male" | "female";
export type DaparScore = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90;
export type MedicalProfile = 21 | 45 | 64 | 72 | 82 | 97;
export type ExplicitUnknown = "unknown";
export type DaparAnswer = DaparScore | ExplicitUnknown | null;
export type MedicalProfileAnswer = MedicalProfile | ExplicitUnknown | null;
export type YomHameahSource = "official" | "self" | ExplicitUnknown | "";

export type RoleInterest =
  | "cyber"
  | "combat"
  | "intelligence"
  | "technology_engineering"
  | "medical"
  | "air_force"
  | "navy"
  | "instruction_education"
  | "logistics"
  | "undecided";

export type RoleAvoidance =
  | "kitchen_maintenance"
  | "guard_duty_nights"
  | "far_from_home"
  | "office_only"
  | "too_physical"
  | "monotonous";

export type ExitPreference =
  | "week_on_off"
  | "hamshushim"
  | "shushim"
  | "twelve_two"
  | "twenty_one"
  | "rare"
  | "no_preference";

export type EnvironmentPreference = "office" | "field" | "mixed" | "no_preference";
export type LeadershipPreference = "want_lead" | "open" | "prefer_team";
export type StressPreference = "high" | "moderate" | "low";

export type Run3kmBand = "unknown" | "over_15" | "13_to_15" | "under_13";
export type PullUpsBand = "unknown" | "0_to_5" | "6_to_15" | "16_plus";
export type PushUpsBand = "unknown" | "0_to_30" | "31_to_60" | "61_plus";
export type CombatReadiness = "ready" | "needs_improvement" | "wants_to_improve" | "unsure";

export type TechnicalLevel = "none" | "basic" | "intermediate" | "advanced" | "expert";
export type TechnicalArea =
  | "programming"
  | "cybersecurity"
  | "networks"
  | "data_ai"
  | "hardware_electronics"
  | "undecided";

export type Motivation =
  | "contribution"
  | "challenge"
  | "career"
  | "friends_experience"
  | "personal_growth"
  | "unsure";

export type AssessmentStepId =
  | "direction"
  | "roles"
  | "preferences"
  | "environment"
  | "style"
  | "combat"
  | "technical"
  | "scores"
  | "yom"
  | "checkpoint"
  | "motivation"
  | "identity"
  | "review"
  | "email"
  | "otp";

export type CombatDetails = {
  run3kmBand: Run3kmBand | "";
  pullUpsBand: PullUpsBand | "";
  pushUpsBand: PushUpsBand | "";
  readiness: CombatReadiness | "";
};

export type TechnicalDetails = {
  level: TechnicalLevel | "";
  areas: TechnicalArea[];
};

export type AssessmentAnswers = {
  serviceLifeCycle: "pre";
  preferredName: string;
  gender: Gender | "";
  daparScore: DaparAnswer;
  medicalProfile: MedicalProfileAnswer;
  draftDate: string;
  yomHameah: YomHameah;
  yomHameahSource: YomHameahSource;
  combatPreference: CombatPreferenceValue | "";
  focus: FocusPreferenceValue | "";
  physicalActivityLevel: FitnessPreferenceValue | "";
  rolesInterested: RoleInterest[];
  rolesAvoided: RoleAvoidance[];
  exitsPreference: ExitPreference | "";
  environment: EnvironmentPreference | "";
  leadership: LeadershipPreference | "";
  stress: StressPreference | "";
  motivations: Motivation[];
  combatDetails: CombatDetails;
  technicalDetails: TechnicalDetails;
  extraNote: string;
};

export type AssessmentCompletionPayload = {
  schemaVersion: typeof ASSESSMENT_SCHEMA_VERSION;
  clientDraftId: string;
  answers: AssessmentAnswers;
};

export type SavedAssessment = AssessmentCompletionPayload & {
  id: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};
