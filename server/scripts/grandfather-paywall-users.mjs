import "../env.js";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Entitlement from "../models/Entitlement.js";
import User from "../models/User.js";
import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "../services/payments/catalog.js";
import { parsePaywallLaunchAt } from "../services/payments/config.js";
import {
  buildGrandfatherBulkOperation,
  ensureGrandfatherCutoffConsistency,
} from "../utils/grandfathering.js";

function parseArguments(argv) {
  const apply = argv.includes("--apply");
  const batchFlag = argv.find((arg) => arg.startsWith("--batch-size="));
  const unknown = argv.filter(
    (arg) => arg !== "--apply" && !arg.startsWith("--batch-size="),
  );
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  const requested = batchFlag ? Number(batchFlag.split("=")[1]) : 250;
  if (!Number.isInteger(requested) || requested < 10 || requested > 1000) {
    throw new Error("--batch-size must be an integer from 10 through 1000");
  }
  return { apply, batchSize: requested };
}

async function run() {
  const { apply, batchSize } = parseArguments(process.argv.slice(2));
  const launchAt = parsePaywallLaunchAt(process.env.PAYWALL_LAUNCH_AT);
  if (!launchAt) {
    throw new Error("PAYWALL_LAUNCH_AT must be a valid ISO timestamp with a timezone");
  }

  await connectDB();
  await ensureGrandfatherCutoffConsistency(launchAt, { write: apply });
  const eligible = await User.countDocuments({ createdAt: { $lt: launchAt } });
  const counts = {
    mode: apply ? "apply" : "dry-run",
    cutoff: launchAt.toISOString(),
    eligible,
    scanned: 0,
    existingEntitlements: 0,
    alreadyGrandfathered: 0,
    wouldMark: 0,
    created: 0,
    markedExisting: 0,
  };

  let lastId = null;
  while (true) {
    const query = {
      createdAt: { $lt: launchAt },
      ...(lastId ? { _id: { $gt: lastId } } : {}),
    };
    const users = await User.find(query)
      .select("_id createdAt")
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();
    if (!users.length) break;

    const ids = users.map((user) => user._id);
    const existing = await Entitlement.find({
      userId: { $in: ids },
      productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    })
      .select("userId status grandfatheredAt")
      .lean();
    const grandfatheredIds = new Set(
      existing
        .filter((item) => item.grandfatheredAt)
        .map((item) => String(item.userId)),
    );
    counts.scanned += users.length;
    counts.existingEntitlements += existing.length;
    counts.alreadyGrandfathered += grandfatheredIds.size;
    counts.wouldMark += users.length - grandfatheredIds.size;

    if (apply) {
      const result = await Entitlement.bulkWrite(
        users.map((user) =>
          buildGrandfatherBulkOperation({
            userId: user._id,
            userCreatedAt: user.createdAt,
            launchAt,
          }),
        ),
        { ordered: false },
      );
      counts.created += result.upsertedCount || 0;
      counts.markedExisting += result.modifiedCount || 0;
    }

    lastId = users[users.length - 1]._id;
    console.log(
      `[grandfather] scanned=${counts.scanned}/${eligible} ` +
        `alreadyGrandfathered=${counts.alreadyGrandfathered} ` +
        `${apply
          ? `created=${counts.created} markedExisting=${counts.markedExisting}`
          : `wouldMark=${counts.wouldMark}`}`,
    );
  }

  console.log(JSON.stringify(counts, null, 2));
  if (!apply) {
    console.log("[grandfather] Dry run only. Re-run with --apply to write entitlements.");
  }
}

run()
  .catch((error) => {
    console.error(`[grandfather] ${error?.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
