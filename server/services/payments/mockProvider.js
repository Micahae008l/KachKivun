import { PaymentError } from "./errors.js";
import { createOpaqueSecret } from "./secrets.js";

export class MockPaymentProvider {
  constructor(config) {
    this.config = config;
  }

  async createPaymentProcess({ order, method, urls }) {
    return {
      provider: "mock",
      pageCode: `mock-${method}`,
      processId: `mock-${order.publicId}`,
      processToken: createOpaqueSecret(),
      checkoutUrl: urls.successUrl,
    };
  }

  async getPaymentProcessInfo() {
    throw new PaymentError(
      "MOCK_CONFIRMATION_REQUIRED",
      "Mock payments must be confirmed through the development endpoint.",
      409,
    );
  }

  async approveTransaction() {
    return { confirmed: true, alreadyApproved: false };
  }

  async refundTransaction({ order }) {
    return {
      state: "confirmed",
      statusCode: "3",
      statusText: "mock_refunded",
      refundTransactionId: `mock-refund-${order.publicId}`,
    };
  }
}
