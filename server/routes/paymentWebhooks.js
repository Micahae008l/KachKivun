import express, { Router } from "express";
import multer from "multer";
import { growInvoice, growLinkNotify, growNotify } from "../controllers/paymentsController.js";

const router = Router();
const parseUrlEncoded = express.urlencoded({
  extended: false,
  limit: "64kb",
  parameterLimit: 100,
});
const parseJson = express.json({ limit: "64kb" });
const parseMultipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 0,
    fields: 100,
    fieldSize: 16 * 1024,
    parts: 100,
  },
}).none();

function parseGrowWebhook(req, res, next) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.startsWith("application/x-www-form-urlencoded")) {
    return parseUrlEncoded(req, res, next);
  }
  if (contentType.startsWith("multipart/form-data")) {
    return parseMultipart(req, res, next);
  }
  if (contentType.startsWith("application/json")) {
    return parseJson(req, res, next);
  }
  return res.status(415).json({
    error: "Unsupported callback content type",
    code: "PAYMENT_CALLBACK_CONTENT_TYPE",
  });
}

router.post("/notify/:publicId/:callbackSecret", parseGrowWebhook, growNotify);
router.post("/invoice/:publicId/:callbackSecret", parseGrowWebhook, growInvoice);
router.post("/link/:callbackSecret", parseGrowWebhook, growLinkNotify);

router.use((error, _req, res, next) => {
  if (
    error instanceof multer.MulterError ||
    error?.type === "entity.too.large" ||
    error?.status === 413
  ) {
    return res.status(413).json({
      error: "Callback payload is too large",
      code: "PAYMENT_CALLBACK_TOO_LARGE",
    });
  }
  if ((error instanceof SyntaxError || error?.status === 400) && error.status === 400) {
    return res.status(400).json({
      error: "Invalid callback body",
      code: "PAYMENT_CALLBACK_INVALID_BODY",
    });
  }
  return next(error);
});

export default router;
