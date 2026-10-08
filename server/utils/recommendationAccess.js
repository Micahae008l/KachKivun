import Entitlement from "../models/Entitlement.js";
import User from "../models/User.js";
import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "../services/payments/catalog.js";
import {
  isPaywallEnabled,
  parsePaywallLaunchAt,
} from "../services/payments/config.js";
import {
  buildGrandfatherEntitlementUpsert,
  ensureGrandfatherCutoffConsistency,
  isGrandfatherEligible,
} from "./grandfathering.js";

export { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY, isPaywallEnabled };

export function isActiveEntitlement(entitlement, now = new Date()) {
  if (!entitlement || !["active", "grandfathered"].includes(entitlement.status)) {
    return false;
  }

  const at = now instanceof Date ? now : new Date(now);
  const startsAt = entitlement.startsAt ? new Date(entitlement.startsAt) : null;
  const expiresAt = entitlement.expiresAt ? new Date(entitlement.expiresAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > at) return false;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= at) return false;
  return true;
}

export function hasGrandfatherMarker(entitlement, now = new Date()) {
  if (!entitlement?.grandfatheredAt) return false;
  const markedAt = new Date(entitlement.grandfatheredAt);
  const at = now instanceof Date ? now : new Date(now);
  return (
    !Number.isNaN(markedAt.getTime()) &&
    !Number.isNaN(at.getTime()) &&
    markedAt <= at
  );
}

export function resolveRecommendationAccess({
  paywallEnabled = isPaywallEnabled(),
  userRole = "user",
  entitlement = null,
  grandfatherEligible = false,
  now = new Date(),
} = {}) {
  const enabled = Boolean(paywallEnabled);
  const topTwoUnlocked =
    !enabled ||
    userRole === "admin" ||
    Boolean(grandfatherEligible) ||
    hasGrandfatherMarker(entitlement, now) ||
    isActiveEntitlement(entitlement, now);

  return {
    paywallEnabled: enabled,
    topTwoUnlocked,
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
  };
}

export async function getRecommendationAccessForUser(
  userId,
  {
    userRole,
    paywallEnabled = isPaywallEnabled(),
    launchAt = process.env.PAYWALL_LAUNCH_AT,
    now = new Date(),
    UserModel = User,
    EntitlementModel = Entitlement,
    ensureCutoffConsistency = ensureGrandfatherCutoffConsistency,
  } = {},
) {
  if (!paywallEnabled) {
    return resolveRecommendationAccess({ paywallEnabled: false, userRole, now });
  }

  const cutoff = launchAt instanceof Date ? launchAt : parsePaywallLaunchAt(launchAt);
  const user = await UserModel.findById(userId).select("role createdAt").lean();
  const resolvedRole = userRole || user?.role || "user";
  if (resolvedRole === "admin") {
    return resolveRecommendationAccess({
      paywallEnabled: true,
      userRole: resolvedRole,
      now,
    });
  }
  if (cutoff) {
    await ensureCutoffConsistency(cutoff, { EntitlementModel });
  }

  let entitlement = await EntitlementModel.findOne({
    userId,
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
  })
    .sort({ updatedAt: -1 })
    .lean();
  const grandfatherEligible = Boolean(
    cutoff && user && isGrandfatherEligible(user.createdAt, cutoff),
  );

  if (grandfatherEligible && !hasGrandfatherMarker(entitlement, now)) {
    const operation = buildGrandfatherEntitlementUpsert({
      userId,
      userCreatedAt: user.createdAt,
      launchAt: cutoff,
    });
    try {
      entitlement = await EntitlementModel.findOneAndUpdate(
        operation.filter,
        operation.update,
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      ).lean();
    } catch (error) {
      // A concurrent migration/access check can win the unique upsert race.
      // Eligibility itself remains authoritative so an old account is never
      // retroactively hidden because the durable marker arrived a moment later.
      if (error?.code !== 11000) throw error;
    }
  }

  return resolveRecommendationAccess({
    paywallEnabled: true,
    userRole: resolvedRole,
    entitlement,
    grandfatherEligible,
    now,
  });
}
