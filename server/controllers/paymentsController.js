import {
  cancelPaymentOrder,
  checkoutParentShare,
  confirmMockPayment,
  createAuthenticatedCheckout,
  createParentShare,
  getAuthenticatedOrderStatus,
  getParentShareSummary,
  getPublicPaymentOffer,
  getReturnOrderStatus,
  listAuthenticatedPaymentOrders,
  processGrowCallback,
  processGrowInvoiceCallback,
  refundPaymentOrder,
} from "../services/payments/paymentService.js";
import { sendPaymentError } from "../services/payments/errors.js";
import { processGrowLinkWebhook } from "../services/payments/growLinkWebhook.js";

export function getOffer(_req, res) {
  try {
    return res.json(getPublicPaymentOffer());
  } catch (error) {
    return sendPaymentError(res, error, "[payments/offer]");
  }
}

export async function checkout(req, res) {
  try {
    const order = await createAuthenticatedCheckout({
      userId: req.userId,
      payload: req.body,
    });
    return res.status(201).json({ order });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/checkout]");
  }
}

export async function createShare(req, res) {
  try {
    const share = await createParentShare({
      userId: req.userId,
      productKey: req.body.productKey,
    });
    return res.status(201).json(share);
  } catch (error) {
    return sendPaymentError(res, error, "[payments/parent-share]");
  }
}

export async function getShare(req, res) {
  try {
    return res.json(await getParentShareSummary(req.params.shareToken));
  } catch (error) {
    return sendPaymentError(res, error, "[payments/share]");
  }
}

export async function checkoutShare(req, res) {
  try {
    const order = await checkoutParentShare({
      shareToken: req.params.shareToken,
      payload: req.body,
    });
    return res.status(201).json({ order });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/share/checkout]");
  }
}

export async function getOrderStatus(req, res) {
  try {
    return res.json(
      await getAuthenticatedOrderStatus({
        userId: req.userId,
        publicId: req.params.publicId,
      }),
    );
  } catch (error) {
    return sendPaymentError(res, error, "[payments/status]");
  }
}

export async function listOrders(req, res) {
  try {
    const orders = await listAuthenticatedPaymentOrders({
      userId: req.userId,
      limit: req.query.limit,
    });
    return res.json({ orders });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/orders]");
  }
}

export async function getReturnStatus(req, res) {
  try {
    return res.json(
      await getReturnOrderStatus({
        publicId: req.params.publicId,
        returnToken: req.params.returnToken,
      }),
    );
  } catch (error) {
    return sendPaymentError(res, error, "[payments/return-status]");
  }
}

export async function growNotify(req, res) {
  try {
    const result = await processGrowCallback({
      publicId: req.params.publicId,
      callbackSecret: req.params.callbackSecret,
      payload: req.body,
    });
    return res.status(200).json({ received: true, status: result.state });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/grow/notify]");
  }
}

export async function growLinkNotify(req, res) {
  try {
    const result = await processGrowLinkWebhook({
      callbackSecret: req.params.callbackSecret,
      payload: req.body,
    });
    return res.status(200).json({ received: true, status: result.state });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/grow_link/notify]");
  }
}

export async function growInvoice(req, res) {
  try {
    await processGrowInvoiceCallback({
      publicId: req.params.publicId,
      callbackSecret: req.params.callbackSecret,
      payload: req.body,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/grow/invoice]");
  }
}

export async function cancelOrder(req, res) {
  try {
    const order = await cancelPaymentOrder({
      userId: req.userId,
      publicId: req.params.publicId,
      reason: req.body.reason,
    });
    return res.json({ order });
  } catch (error) {
    return sendPaymentError(res, error, "[payments/cancel]");
  }
}

export async function refundOrder(req, res) {
  try {
    return res.json(
      await refundPaymentOrder({
        userId: req.userId,
        publicId: req.params.publicId,
        reason: req.body.reason,
      }),
    );
  } catch (error) {
    return sendPaymentError(res, error, "[payments/refund]");
  }
}

export async function mockConfirm(req, res) {
  try {
    return res.json(
      await confirmMockPayment({
        userId: req.userId,
        publicId: req.params.publicId,
      }),
    );
  } catch (error) {
    return sendPaymentError(res, error, "[payments/mock-confirm]");
  }
}

export async function mockConfirmReturn(req, res) {
  try {
    return res.json(
      await confirmMockPayment({
        publicId: req.params.publicId,
        returnToken: req.params.returnToken,
      }),
    );
  } catch (error) {
    return sendPaymentError(res, error, "[payments/mock-confirm-return]");
  }
}
