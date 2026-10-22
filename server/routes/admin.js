import { Router } from "express";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  validateAdminUserRole,
  validateAdminUserTokenCap,
  validateAdminUsersQuery,
  validateBlockIp,
  validateObjectIdParam,
  validateSecurityEventsQuery,
} from "../validators/admin.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  getAdminMe,
  getOverview,
  listUsers,
  getUserJourney,
  updateUserRole,
  updateUserTokenCap,
  deleteUser,
} from "../controllers/adminController.js";
import { getInsights } from "../controllers/adminInsightsController.js";
import {
  createPromoCode,
  listPromoCodes,
  updatePromoCode,
} from "../controllers/promoCodesController.js";
import {
  adminListReviews,
  adminModerateReview,
} from "../controllers/roleReviewsController.js";
import {
  getSecurityOverview,
  listSecurityEvents,
  listBlockedIps,
  blockIp,
  unblockIp,
} from "../controllers/securityController.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/me", getAdminMe);
router.get("/overview", getOverview);
router.get("/insights", getInsights);
router.get("/users", validateRequest(validateAdminUsersQuery), listUsers);
router.get("/users/:id/journey", validateRequest(validateObjectIdParam("id")), getUserJourney);
router.patch("/users/:id/role", validateRequest(validateAdminUserRole), updateUserRole);
router.patch(
  "/users/:id/token-cap",
  validateRequest(validateAdminUserTokenCap),
  updateUserTokenCap
);
router.delete("/users/:id", validateRequest(validateObjectIdParam("id")), deleteUser);

router.get("/promo-codes", listPromoCodes);
router.post("/promo-codes", createPromoCode);
router.patch("/promo-codes/:id", validateRequest(validateObjectIdParam("id")), updatePromoCode);

router.get("/role-reviews", adminListReviews);
router.patch(
  "/role-reviews/:id",
  validateRequest(validateObjectIdParam("id")),
  adminModerateReview
);

router.get("/security/overview", getSecurityOverview);
router.get("/security/events", validateRequest(validateSecurityEventsQuery), listSecurityEvents);
router.get("/security/blocked-ips", listBlockedIps);
router.post("/security/blocked-ips", validateRequest(validateBlockIp), blockIp);
router.delete(
  "/security/blocked-ips/:id",
  validateRequest(validateObjectIdParam("id")),
  unblockIp
);

export default router;
