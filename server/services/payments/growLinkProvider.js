import { PaymentError } from "./errors.js";
import { createOpaqueSecret } from "./secrets.js";

/**
 * Grow "Payment Links" without API access: every buyer is sent to the same
 * merchant-configured page, and Grow reports payments through a webhook that
 * support enables per link. There is no inquiry, approval or refund API, so
 * refunds are performed by the operator in the Grow dashboard.
 */
export class GrowLinkProvider {
  constructor(config) {
    this.config = config;
  }

  async createPaymentProcess({ order }) {
    if (!this.config.paymentLinkUrl) {
      throw new PaymentError("PAYMENT_CONFIG_INVALID", undefined, 500);
    }
    return {
      provider: "grow_link",
      pageCode: "",
      processId: `link-${order.publicId}`,
      processToken: createOpaqueSecret(),
      checkoutUrl: this.config.paymentLinkUrl,
    };
  }

  async getPaymentProcessInfo() {
    throw new PaymentError("GROW_LINK_INQUIRY_UNAVAILABLE", undefined, 409);
  }

  async approveTransaction() {
    return { confirmed: true, alreadyApproved: false };
  }

  async refundTransaction() {
    return { state: "requested", statusCode: "manual", statusText: "manual_refund_pending" };
  }
}
