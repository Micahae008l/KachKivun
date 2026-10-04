import User from "../models/User.js";

/** How many of the best matches sit behind the payment. */
export const LOCKED_TOP = 2;

/** The paywall is off until PAYWALL_ENABLED=true, so deploying this changes nothing by itself. */
export function isPaywallEnabled() {
  return String(process.env.PAYWALL_ENABLED || "").trim() === "true";
}

/** Admins and users who paid see everything; everyone does while the paywall is off. */
export async function isTopUnlocked(userId) {
  if (!isPaywallEnabled()) return true;
  const user = await User.findById(userId).select("role topMatchesUnlockedAt").lean();

  return user?.role === "admin" || Boolean(user?.topMatchesUnlockedAt);
}

/**
 * Hide ranks 1..LOCKED_TOP of a best-first role list. A locked role keeps only its
 * rank and match percentage (the teaser); title, description and tags never leave
 * the server, so the browser's devtools can't reveal them.
 */
export function lockTopRoles(roles, unlocked) {
  if (unlocked || !Array.isArray(roles)) return roles;

  return roles.map((role, i) =>
    i < LOCKED_TOP ? { locked: true, rank: i + 1, matchPercentage: role?.matchPercentage ?? null } : role,
  );
}

/** Route guard for what the payment buys besides the cards (full report, its PDF). */
export async function requireTopUnlocked(req, res, next) {
  try {
    if (await isTopUnlocked(req.userId)) return next();
    return res.status(402).json({
      error: "הדוח המלא נפתח יחד עם 2 ההתאמות המובילות שלכם",
      code: "TOP_MATCHES_LOCKED",
    });
  } catch (err) {
    next(err);
  }
}
