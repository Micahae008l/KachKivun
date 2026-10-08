import { clearToken, getToken, setStoredRole, setToken } from "./auth";
import type { AssessmentCompletionPayload, SavedAssessment } from "@/features/assessment/types";

function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  return raw?.replace(/\/$/, "") ?? "";
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ApiFetchOptions = RequestInit & { skipAuth?: boolean; retries?: number };

let refreshPromise: Promise<string | null> | null = null;

function retryDelayMs(attempt: number, status?: number): number {
  // A sleeping free-tier Render instance takes ~50s to wake, so unreachable-host
  // and 503 retries need a budget in that range rather than a couple of seconds.
  if (status === 503 || status === 0) {
    return Math.min(8000, 800 * 2 ** attempt);
  }
  return 600;
}

/**
 * Fire-and-forget ping that starts the API waking up while the visitor reads or
 * answers the wizard, so their first real call is not the one paying cold start.
 */
export function warmApi(): void {
  if (typeof window === "undefined") return;
  void fetch(`${apiBase()}/api/health`, { credentials: "omit" }).catch(() => {
    /* warm-up only, failures are irrelevant */
  });
}

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const { skipAuth, retries = 2, ...rest } = init ?? {};
  const maxAttempts = Math.max(1, retries + 1);
  let lastError: ApiError | null = null;
  let didRefresh = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelayMs(attempt - 1, lastError?.status)));
    }

    const headers = new Headers(rest.headers);
    if (!headers.has("Content-Type") && rest.body != null) {
      headers.set("Content-Type", "application/json");
    }
    const token = skipAuth ? null : getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetch(`${apiBase()}${path}`, {
        ...rest,
        headers,
        credentials: rest.credentials ?? "include",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      lastError = new ApiError(msg, 0);
      if (attempt < maxAttempts - 1) continue;
      throw lastError;
    }

    const text = await res.text();
    let json: unknown = {};
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = {};
      }
    }
    if (!res.ok) {
      let msg =
        typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof (json as { error: unknown }).error === "string"
          ? (json as { error: string }).error
          : res.statusText;
      if ((!msg || msg === "Internal Server Error") && (res.status === 500 || res.status === 502)) {
        msg = "שגיאת שרת. בפיתוח מקומי: הריצו npm run dev (Vite + API) או npm run server ליד Vite.";
      }
      if ((!msg || msg === "Service Unavailable") && res.status === 503) {
        msg =
          "השרת לא זמין (503). בפיתוח: הריצו מהשורש npm run dev, או npm run server (פורט 3001) לצד npm run dev:web. ודאו ש־MongoDB רץ ושהגדרות השרת ב־server/.env.";
      }
      const errCode =
        typeof json === "object" &&
        json !== null &&
        "code" in json &&
        typeof (json as { code: unknown }).code === "string"
          ? (json as { code: string }).code
          : undefined;
      if (!skipAuth && token && res.status === 401 && !didRefresh && path !== "/api/auth/refresh") {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          didRefresh = true;
          attempt -= 1;
          continue;
        }
        clearToken();
      }
      lastError = new ApiError(msg, res.status, errCode);
      const retryable = res.status === 503 || res.status === 502 || res.status === 504;
      if (retryable && attempt < maxAttempts - 1) continue;
      throw lastError;
    }
    return json as T;
  }

  throw lastError ?? new ApiError("Request failed", 0);
}

export type LoginResponse = {
  token: string;
  userId: string;
  status?: string;
  role?: "user" | "admin";
  isNewUser?: boolean;
};

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        const text = await res.text();
        const json = text ? (JSON.parse(text) as Partial<LoginResponse>) : {};
        if (!res.ok || typeof json.token !== "string") {
          clearToken();
          return null;
        }
        setToken(json.token);
        setStoredRole(json.role);
        return json.token;
      } catch {
        clearToken();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/** Restore in-memory access JWT from the httpOnly refresh cookie (page load). */
export async function bootstrapAuth(): Promise<boolean> {
  if (getToken()) return true;
  const token = await refreshAccessToken();
  return Boolean(token);
}

export async function logoutRequest() {
  clearToken();
  try {
    await fetch(`${apiBase()}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Local logout should still complete even if the API is temporarily unavailable.
  }
}

export type SessionResponse = {
  userId: string;
  email: string;
  role: "user" | "admin";
  preferredName: string;
  status: string;
};

export function getSession() {
  return apiFetch<SessionResponse>("/api/auth/me");
}

export type OtpRequestResponse = {
  message: string;
  expiresInSeconds: number;
  delivery?: "email" | "console";
  /** Dev only — when SMTP is off, so you can copy the code in the UI */
  devCode?: string;
};

export type AuthIntent = "login" | "signup";

export function requestOtp(email: string, options?: { intent?: AuthIntent }) {
  return apiFetch<OtpRequestResponse>("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ email, intent: options?.intent ?? "login" }),
    skipAuth: true,
    // First call most visitors make, so it is the one that hits a cold server.
    retries: 5,
  });
}

export function verifyOtp(email: string, code: string, options?: { intent?: AuthIntent }) {
  return apiFetch<LoginResponse>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code, intent: options?.intent ?? "login" }),
    skipAuth: true,
  });
}

export type AssessmentCompletionResponse = {
  assessmentId: string;
  schemaVersion: number;
  completedAt: string;
  transactionMode: "transaction" | "standalone-fallback";
};

export function completeAssessment(payload: AssessmentCompletionPayload) {
  return apiFetch<AssessmentCompletionResponse>("/api/assessments/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLatestAssessment() {
  return apiFetch<{ assessment: SavedAssessment | null }>("/api/assessments/latest");
}

export type ServiceLifeCycle = "pre" | "serving" | "veteran";

import type { YomHameah as _YomHameah, YomHameahKey as _YomHameahKey } from "./yom-hameah";
export type YomHameah = _YomHameah;
export type YomHameahKey = _YomHameahKey;

export type YomQuestionnaireEntry = { questionId: string; score: number };

export type RegisterProfilePayload = {
  serviceLifeCycle: ServiceLifeCycle;
  preferredName?: string;
  draftDate?: string | null;
  dischargeDate?: string | null;
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
  daparScore?: number | null;
  medicalProfile?: number | null;
  yomHameah?: YomHameah | null;
  yomQuestionnaire?: YomQuestionnaireEntry[];
  yomHameahSource?: "official" | "self" | "unknown";
  preferences?: Partial<{
    combatPreference: string;
    schedule: string;
    focus: string;
    location: string;
    physicalActivityLevel: string;
  }>;
  phone?: string;
};

export type ScoreOnboardingPayload = {
  username: string;
  serviceLifeCycle?: ServiceLifeCycle;
  daparScore: number;
  medicalProfile: number;
  gender?: "male" | "female" | null;
  yomHameah: YomHameah;
  yomHameahSource: "official" | "self";
  /** yyyy-mm-dd — required for AI */
  draftDate: string;
  preferences: {
    combatPreference: string;
    focus: string;
    physicalActivityLevel: string;
    schedule?: string;
    location?: string;
  };
};

export function completeScoreOnboarding(payload: ScoreOnboardingPayload) {
  const body: ProfileUpdateBody = {
    user: {
      preferredName: payload.username,
      serviceLifeCycle: payload.serviceLifeCycle ?? "pre",
    },
    stats: {
      daparScore: payload.daparScore,
      medicalProfile: payload.medicalProfile,
      gender: payload.gender ?? null,
      yomHameah: payload.yomHameah,
      draftDate: payload.draftDate,
    },
    preferences: {
      ...payload.preferences,
      yomHameahSource: payload.yomHameahSource,
    },
  };

  return updateProfile(body).catch(async (err) => {
    // Old API builds reject gender under stats — don't block signup.
    if (err instanceof ApiError && /unknown (stats )?field:\s*gender/i.test(err.message || "")) {
      const { gender: _ignored, ...statsWithoutGender } = body.stats ?? {};
      return updateProfile({ ...body, stats: statsWithoutGender });
    }
    throw err;
  });
}

export type MilitaryStatsDto = {
  draftDate?: string | null;
  dischargeDate?: string | null;
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
  daparScore?: number | null;
  medicalProfile?: number | null;
  gender?: "male" | "female" | null;
  yomHameah?: YomHameah | null;
  yomQuestionnaire?: YomQuestionnaireEntry[];
};

export type PreferencesDto = {
  combatPreference?: string;
  schedule?: string;
  focus?: string;
  location?: string;
  physicalActivityLevel?: string;
  yomHameahSource?: string;
};

export type AiTokenCapStatus = {
  used: number;
  cap: number | null;
  remaining: number | null;
  unlimited: boolean;
  capped: boolean;
};

export type DashboardResponse = {
  user: {
    email: string;
    preferredName?: string;
    phone?: string;
    status: string;
    createdAt?: string;
  };
  stats: MilitaryStatsDto | null;
  preferences: PreferencesDto | null;
  daysRemaining: number | null;
  aiReady?: boolean;
  aiProfileMissing?: string[];
  aiTokens?: AiTokenCapStatus;
};

export function getDashboardStats() {
  return apiFetch<DashboardResponse>("/api/dashboard/stats");
}

export type ProfileUpdateBody = {
  status?: string;
  user?: {
    preferredName?: string;
    phone?: string;
    serviceLifeCycle?: ServiceLifeCycle;
  };
  stats?: Partial<{
    draftDate: string | null;
    dischargeDate: string | null;
    serviceStartDate: string | null;
    serviceEndDate: string | null;
    daparScore: number | null;
    medicalProfile: number | null;
    gender: "male" | "female" | null;
    yomHameah: YomHameah | null;
    yomQuestionnaire: YomQuestionnaireEntry[];
  }>;
  preferences?: Partial<{
    combatPreference: string;
    schedule: string;
    focus: string;
    location: string;
    physicalActivityLevel: string;
    yomHameahSource: string;
  }>;
};

export function updateProfile(body: ProfileUpdateBody) {
  return apiFetch<{ message: string }>("/api/profile/update", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ── Payments (checkout UI is implemented separately) ───────────────────────

export type PaymentMethod = "apple_pay" | "bit" | "google_pay" | "card";
export type PaymentOrderStatus =
  | "created"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refund_requested"
  | "refunded"
  | "expired";

export type PaymentProduct = {
  productKey: "ai_counselor_top_two";
  displayName: string;
  amountMinor: number;
  currency: "ILS";
  permanent: true;
  futureRecalculationsIncluded: true;
  vatIncludedWhereApplicable: true;
  billingType: "one_time";
};

export type PaymentMerchant = {
  legalName?: string;
  phone?: string;
  address?: string;
  contactEmail?: string;
  cancellationUrl?: string;
};

export type PaymentOffer = {
  enabled: boolean;
  personalizedFunnelV2: boolean;
  product: PaymentProduct;
  paymentMethods: PaymentMethod[];
  processor: "Grow" | "Mock (development only)";
  receiptsProvided: boolean;
  /** Grow's own page collects payer name, phone and method (payment-link mode). */
  hostedPayerDetails?: boolean;
  merchant: PaymentMerchant;
};

export type PaymentOrderDto = {
  id: string;
  product: PaymentProduct;
  status: PaymentOrderStatus;
  provider: "grow" | "grow_link" | "mock";
  /** Payment-link mode: the code the payer types on Grow's page. */
  claimCode?: string;
  /** Payment-link mode, first response only: where to check the result. */
  returnUrl?: string;
  paymentMethod: PaymentMethod | null;
  confirmations: {
    termsAndCancellationAccepted: boolean;
    adultPayerConfirmed: boolean;
  };
  checkoutUrl?: string;
  requiresMockConfirmation?: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  paidAt: string | null;
  refundRequestedAt: string | null;
  refundedAt: string | null;
  cancellation: {
    requestEligible: boolean;
    state: "eligible" | "pending_provider" | "provider_confirmed" | "not_eligible";
  };
  invoice: { number: string; url: string } | null;
  refundReceipt: { number: string; url: string } | null;
};

export type PaymentPayer = {
  fullName: string;
  phone: string;
};

export type PaymentConfirmations = {
  termsAndCancellationAccepted: true;
  adultPayerConfirmed: true;
};

export function getPaymentOffer() {
  return apiFetch<PaymentOffer>("/api/payments/offer", { skipAuth: true });
}

export function createPaymentCheckout(payload: {
  idempotencyKey: string;
  payer?: PaymentPayer;
  confirmations: PaymentConfirmations;
  paymentMethod?: PaymentMethod;
  productKey?: "ai_counselor_top_two";
}) {
  return apiFetch<{ order: PaymentOrderDto }>("/api/payments/checkout", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      productKey: payload.productKey ?? "ai_counselor_top_two",
    }),
    retries: 0,
  });
}

export function createParentPaymentShare(
  productKey: "ai_counselor_top_two" = "ai_counselor_top_two",
) {
  return apiFetch<{
    shareUrl: string;
    expiresAt: string;
    product: PaymentProduct;
  }>("/api/payments/parent-share", {
    method: "POST",
    body: JSON.stringify({ productKey }),
  });
}

export function getParentPaymentShare(shareToken: string) {
  return apiFetch<{
    product: PaymentProduct;
    expiresAt: string;
    available: boolean;
    status: PaymentOrderStatus;
    paymentMethods: PaymentMethod[];
    processor?: "Grow" | "Mock (development only)";
    receiptsProvided?: boolean;
    hostedPayerDetails?: boolean;
    merchant?: PaymentMerchant;
  }>(`/api/payments/share/${encodeURIComponent(shareToken)}`, { skipAuth: true });
}

export function checkoutParentPaymentShare(
  shareToken: string,
  payload: {
    payer?: PaymentPayer;
    confirmations: PaymentConfirmations;
    paymentMethod?: PaymentMethod;
  },
) {
  return apiFetch<{ order: PaymentOrderDto }>(
    `/api/payments/share/${encodeURIComponent(shareToken)}/checkout`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
      retries: 0,
    },
  );
}

export function getPaymentOrder(publicId: string) {
  return apiFetch<{ order: PaymentOrderDto; reconciliation: string }>(
    `/api/payments/orders/${encodeURIComponent(publicId)}`,
    { retries: 0 },
  );
}

export function listPaymentOrders(limit = 25) {
  return apiFetch<{ orders: PaymentOrderDto[] }>(
    `/api/payments/orders?limit=${Math.min(50, Math.max(1, Math.round(limit)))}`,
    { retries: 0 },
  );
}

export function getPaymentReturnStatus(publicId: string, returnToken: string) {
  return apiFetch<{ order: PaymentOrderDto; reconciliation: string }>(
    `/api/payments/return/${encodeURIComponent(publicId)}/${encodeURIComponent(returnToken)}`,
    { skipAuth: true, retries: 0 },
  );
}

export function cancelPaymentOrder(publicId: string) {
  return apiFetch<{ order: PaymentOrderDto }>(
    `/api/payments/orders/${encodeURIComponent(publicId)}/cancel`,
    { method: "POST" },
  );
}

export function refundPaymentOrder(publicId: string, reason = "") {
  return apiFetch<{
    order: PaymentOrderDto;
    duplicate: boolean;
    reconciliation?: string;
  }>(`/api/payments/orders/${encodeURIComponent(publicId)}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    retries: 0,
  });
}

export function confirmMockPayment(publicId: string) {
  return apiFetch<{ order: PaymentOrderDto; duplicate: boolean }>(
    `/api/payments/orders/${encodeURIComponent(publicId)}/mock-confirm`,
    { method: "POST" },
  );
}

export function confirmMockReturnPayment(publicId: string, returnToken: string) {
  return apiFetch<{ order: PaymentOrderDto; duplicate: boolean }>(
    `/api/payments/return/${encodeURIComponent(publicId)}/${encodeURIComponent(returnToken)}/mock-confirm`,
    { method: "POST", skipAuth: true },
  );
}

export type RecommendationAccess = {
  paywallEnabled: boolean;
  topTwoUnlocked: boolean;
  productKey: "ai_counselor_top_two";
};

export type RecommendationScoreBreakdown = {
  preference: number;
  focus: number;
  yom: number;
  eligibility: number;
  catalogQuality: number;
  structuredAssessment: number;
};

export type UnlockedRoleMatch = {
  kind: "role";
  locked: false;
  rank: number;
  roleTitle: string;
  matchPercentage: number;
  scoreBreakdown: RecommendationScoreBreakdown | null;
  summary: string;
  description: string;
  tags: string[];
  nextStepPrompts: string[];
  category: string;
  combat: boolean;
  dayToDay: string;
  requirements: string[];
  locations: string[];
  serviceLengthLabel: string;
  /** Rough chance of getting in; absent on results saved before it existed. */
  admissionChance?: {
    level: "high" | "medium" | "low" | "unknown";
    label: string;
    reason: string;
  } | null;
};

export type LockedRoleMatch = {
  kind: "locked";
  locked: true;
  rank: number;
  matchPercentage: number;
};

export type RoleMatch = UnlockedRoleMatch | LockedRoleMatch;

export function matchRolesRequest() {
  return apiFetch<{
    recommendationId?: string;
    roles: RoleMatch[];
    access?: RecommendationAccess;
    cached?: boolean;
    notice?: string;
    personalAnswer?: string;
  }>("/api/ai/match-roles", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type MatchHistoryItem = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  engineVersion: string;
  topRole: string;
  topMatch: number | null;
  roleCount: number;
  roleTitles: string[];
  recommendationId?: string;
  access?: RecommendationAccess;
  personalAnswer?: string;
};

export type MatchHistoryDetail = MatchHistoryItem & {
  roles: RoleMatch[];
};

export function listMatchHistory() {
  return apiFetch<{
    generations: MatchHistoryItem[];
    access?: RecommendationAccess;
  }>("/api/ai/match-history");
}

export function getMatchHistory(id: string) {
  return apiFetch<{
    generation: MatchHistoryDetail;
    access?: RecommendationAccess;
  }>(`/api/ai/match-history/${id}`);
}

export function deleteMatchHistory(id: string) {
  return apiFetch<{ message: string; id: string }>(`/api/ai/match-history/${id}`, {
    method: "DELETE",
  });
}

// ── Role insights catalog (public) ──────────────────────────────────────────

export type RoleInsightListItem = {
  slug: string;
  roleTitle: string;
  category: string;
  combat: boolean;
  selective: boolean;
  signals: string[];
  tagsHe: string[];
  summary: string;
};

export type RoleInsightDetail = RoleInsightListItem & {
  tags: string[];
  about: string;
  dayToDay: string;
  requirements: string[];
  locations: string[];
  serviceLengthLabel: string;
  daparFloor: number | null;
  medicalFloor: number | null;
  physicalDemand: number | null;
  techIntensity: number | null;
  peopleIntensity: number | null;
  officialDirectoryUrl: string;
  officialSearchUrl: string;
};

export function listRoles(params?: { q?: string; category?: string; combat?: string }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.category) sp.set("category", params.category);
  if (params?.combat) sp.set("combat", params.combat);
  const qs = sp.toString();
  return apiFetch<{
    count: number;
    total: number;
    categories: string[];
    roles: RoleInsightListItem[];
  }>(`/api/roles${qs ? `?${qs}` : ""}`, { skipAuth: true });
}

export function getRoleInsight(slugOrTitle: string) {
  return apiFetch<{ role: RoleInsightDetail }>(`/api/roles/${encodeURIComponent(slugOrTitle)}`, {
    skipAuth: true,
  });
}

export type RoleReview = {
  id: string;
  roleTitle: string;
  roleSlug: string;
  displayName: string;
  body: string;
  rating: number | null;
  servedInRole: boolean;
  createdAt: string;
};

export type AdminRoleReview = RoleReview & {
  status: "pending" | "approved" | "rejected";
  userEmail: string;
  userId: string | null;
  rejectReason: string;
  moderatedAt: string | null;
  updatedAt: string;
};

export function listRoleReviews(slugOrTitle: string) {
  return apiFetch<{ roleSlug: string; roleTitle: string; reviews: RoleReview[] }>(
    `/api/roles/${encodeURIComponent(slugOrTitle)}/reviews`,
    { skipAuth: true },
  );
}

export function submitRoleReview(
  slugOrTitle: string,
  body: { displayName: string; body: string; rating?: number | null; servedInRole?: boolean },
) {
  return apiFetch<{ message: string; review: { id: string; status: string } }>(
    `/api/roles/${encodeURIComponent(slugOrTitle)}/reviews`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function listAdminRoleReviews(
  status: "pending" | "approved" | "rejected" | "all" = "pending",
) {
  return apiFetch<{ pendingCount: number; reviews: AdminRoleReview[] }>(
    `/api/admin/role-reviews?status=${encodeURIComponent(status)}`,
  );
}

export function moderateRoleReview(id: string, action: "approve" | "reject", reason?: string) {
  return apiFetch<{ message: string; review: AdminRoleReview }>(`/api/admin/role-reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
}

/** Stable client-side slug (mirrors server). */
export function roleInsightSlug(title: string) {
  return (
    String(title || "")
      .trim()
      .toLowerCase()
      .replace(/[/\\]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^\u0590-\u05FFa-z0-9-]+/gi, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "role"
  );
}

// ── Admin ───────────────────────────────────────────────────────────────────

export type AdminMeResponse = {
  userId: string;
  email: string;
  preferredName: string;
  role: "admin";
};

export type AdminOverviewResponse = {
  users: { total: number; admins: number };
  openai: {
    totalCalls: number;
    successCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    pricing: { inputPer1M: number; outputPer1M: number; note: string };
  };
  recentUsage: Array<{
    userEmail: string;
    endpoint: string;
    model: string;
    totalTokens: number;
    estimatedCostUsd: number;
    status: string;
    createdAt: string;
  }>;
};

export type AdminUserRow = {
  id: string;
  email: string;
  preferredName: string;
  phone: string;
  status: string;
  role: "user" | "admin";
  tokenCap: number | null;
  effectiveTokenCap: number | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  aiReady: boolean;
  aiProfileMissing: string[];
  aiUsage: {
    callCount: number;
    totalTokens: number;
    estimatedCostUsd: number;
    lastCallAt: string | null;
  };
  aiTokens: AiTokenCapStatus;
};

export type AdminUsersResponse = {
  users: AdminUserRow[];
  total: number;
  skip: number;
  limit: number;
  defaults?: { tokenCap: number | null };
};

export function getAdminMe() {
  return apiFetch<AdminMeResponse>("/api/admin/me");
}

export function getAdminOverview() {
  return apiFetch<AdminOverviewResponse>("/api/admin/overview");
}

export function getAdminUsers(params?: { q?: string; skip?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.skip != null) sp.set("skip", String(params.skip));
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return apiFetch<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export function updateAdminUserTokenCap(userId: string, tokenCap: number | null) {
  return apiFetch<{
    message: string;
    user: {
      id: string;
      email: string;
      role: string;
      tokenCap: number | null;
      effectiveTokenCap: number | null;
    };
    aiTokens: AiTokenCapStatus;
  }>(`/api/admin/users/${userId}/token-cap`, {
    method: "PATCH",
    body: JSON.stringify({ tokenCap }),
  });
}

export function updateAdminUserRole(userId: string, role: "user" | "admin") {
  return apiFetch<{ message: string; user: { id: string; email: string; role: string } }>(
    `/api/admin/users/${userId}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export function deleteAdminUser(userId: string) {
  return apiFetch<{ message: string; deletedUserId: string; email: string }>(
    `/api/admin/users/${userId}`,
    { method: "DELETE" },
  );
}

export type SecurityEventType =
  | "rate_limit_api"
  | "rate_limit_auth"
  | "otp_failed"
  | "otp_locked"
  | "invalid_token"
  | "admin_denied"
  | "oversized_url"
  | "payload_too_large"
  | "invalid_json"
  | "suspicious_path"
  | "not_found_probe"
  | "refresh_token_reuse"
  | "blocked_ip_hit";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export type SecurityEventRow = {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip: string;
  method: string;
  path: string;
  userAgent: string;
  email: string;
  statusCode: number | null;
  message: string;
  createdAt: string;
};

export type SecurityOverviewResponse = {
  totals: { last24h: number; last7d: number; allTime: number };
  blockedIpCount: number;
  byType: Array<{ type: SecurityEventType; count: number; lastAt: string }>;
  bySeverity: Array<{ severity: SecuritySeverity; count: number }>;
  timeline: Array<{ hour: string; count: number; severe: number }>;
  topIps: Array<{
    ip: string;
    count: number;
    severe: number;
    types: SecurityEventType[];
    lastAt: string;
    blocked: boolean;
  }>;
  recentEvents: SecurityEventRow[];
};

export type SecurityEventsResponse = {
  events: SecurityEventRow[];
  total: number;
  skip: number;
  limit: number;
};

export type BlockedIpRow = {
  id: string;
  ip: string;
  reason: string;
  blockedBy: string;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
};

export function getSecurityOverview() {
  return apiFetch<SecurityOverviewResponse>("/api/admin/security/overview");
}

export type SecurityEventsFilters = {
  type?: SecurityEventType | "";
  severity?: SecuritySeverity | "";
  ip?: string;
  skip?: number;
  limit?: number;
};

export function getSecurityEvents(params?: SecurityEventsFilters) {
  const sp = new URLSearchParams();
  if (params?.type) sp.set("type", params.type);
  if (params?.severity) sp.set("severity", params.severity);
  if (params?.ip) sp.set("ip", params.ip);
  if (params?.skip != null) sp.set("skip", String(params.skip));
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return apiFetch<SecurityEventsResponse>(`/api/admin/security/events${qs ? `?${qs}` : ""}`);
}

export function getBlockedIps() {
  return apiFetch<{ blockedIps: BlockedIpRow[] }>("/api/admin/security/blocked-ips");
}

export function blockIpRequest(ip: string, reason?: string) {
  return apiFetch<{ message: string; blockedIp: BlockedIpRow }>("/api/admin/security/blocked-ips", {
    method: "POST",
    body: JSON.stringify({ ip, reason: reason || "" }),
  });
}

export function unblockIpRequest(id: string) {
  return apiFetch<{ message: string; ip: string }>(`/api/admin/security/blocked-ips/${id}`, {
    method: "DELETE",
  });
}

export type ContactTopic = "cancellation" | "payment" | "bug" | "account" | "other";

export function sendContactMessage(body: {
  topic: ContactTopic;
  email: string;
  name?: string;
  message: string;
  orderId?: string;
  website?: string;
}) {
  return apiFetch<{ ok: true }>("/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
    retries: 0,
  });
}
