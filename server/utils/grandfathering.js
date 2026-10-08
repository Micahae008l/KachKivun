import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "../services/payments/catalog.js";
import { parsePaywallLaunchAt } from "../services/payments/config.js";
import Entitlement from "../models/Entitlement.js";
import SystemConfig from "../models/SystemConfig.js";

export const GRANDFATHER_SOURCE = "paywall_launch_grandfathering";
export const PAYWALL_LAUNCH_CONFIG_KEY = "paywall_launch_at";

export function assertMatchingGrandfatherCutoff(expected, persisted) {
  const expectedTime = new Date(expected).getTime();
  const persistedTime = new Date(persisted).getTime();
  if (
    !Number.isFinite(expectedTime) ||
    !Number.isFinite(persistedTime) ||
    expectedTime !== persistedTime
  ) {
    const error = new Error(
      "PAYWALL_LAUNCH_AT conflicts with the durable grandfather cutoff",
    );
    error.code = "PAYWALL_LAUNCH_AT_CONFLICT";
    throw error;
  }
}

export async function ensureGrandfatherCutoffConsistency(
  launchAt,
  {
    write = true,
    EntitlementModel = Entitlement,
    SystemConfigModel = SystemConfig,
  } = {},
) {
  const cutoff = launchAt instanceof Date ? launchAt : parsePaywallLaunchAt(launchAt);
  if (!cutoff) throw new TypeError("PAYWALL_LAUNCH_AT must be a valid ISO timestamp");

  const durable = await SystemConfigModel.findOne({
    key: PAYWALL_LAUNCH_CONFIG_KEY,
  }).lean();
  if (durable?.dateValue) {
    assertMatchingGrandfatherCutoff(cutoff, durable.dateValue);
    return durable;
  }

  const marker = await EntitlementModel.findOne({
    grandfatherCutoffAt: { $exists: true, $ne: null },
  })
    .select("grandfatherCutoffAt")
    .lean();
  if (marker?.grandfatherCutoffAt) {
    assertMatchingGrandfatherCutoff(cutoff, marker.grandfatherCutoffAt);
  }
  if (!write) return null;

  try {
    const stored = await SystemConfigModel.findOneAndUpdate(
      { key: PAYWALL_LAUNCH_CONFIG_KEY },
      {
        $setOnInsert: {
          key: PAYWALL_LAUNCH_CONFIG_KEY,
          dateValue: cutoff,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    assertMatchingGrandfatherCutoff(cutoff, stored.dateValue);
    return stored;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const stored = await SystemConfigModel.findOne({
      key: PAYWALL_LAUNCH_CONFIG_KEY,
    }).lean();
    assertMatchingGrandfatherCutoff(cutoff, stored?.dateValue);
    return stored;
  }
}

export function isGrandfatherEligible(userCreatedAt, launchAt = process.env.PAYWALL_LAUNCH_AT) {
  if (!userCreatedAt) return false;
  const cutoff = launchAt instanceof Date ? launchAt : parsePaywallLaunchAt(launchAt);
  const createdAt = userCreatedAt instanceof Date ? userCreatedAt : new Date(userCreatedAt);
  return Boolean(
    cutoff &&
      !Number.isNaN(cutoff.getTime()) &&
      !Number.isNaN(createdAt.getTime()) &&
      createdAt < cutoff,
  );
}

export function buildGrandfatherEntitlementUpsert({
  userId,
  userCreatedAt,
  launchAt = process.env.PAYWALL_LAUNCH_AT,
}) {
  const cutoff = launchAt instanceof Date ? launchAt : parsePaywallLaunchAt(launchAt);
  if (!cutoff || !isGrandfatherEligible(userCreatedAt, cutoff)) {
    throw new TypeError("User is not eligible for paywall grandfathering");
  }
  const startsAt = userCreatedAt instanceof Date ? userCreatedAt : new Date(userCreatedAt);
  return {
    filter: {
      userId,
      productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    },
    update: {
      $set: {
        grandfatheredAt: cutoff,
        grandfatherCutoffAt: cutoff,
      },
      $setOnInsert: {
        userId,
        productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
        status: "grandfathered",
        startsAt,
        expiresAt: null,
        source: GRANDFATHER_SOURCE,
      },
    },
  };
}

export function buildGrandfatherBulkOperation(input) {
  const operation = buildGrandfatherEntitlementUpsert(input);
  return {
    updateOne: {
      ...operation,
      upsert: true,
    },
  };
}
