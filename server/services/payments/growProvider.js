import { PaymentError } from "./errors.js";
import {
  normalizeGrowApprovalResponse,
  normalizeGrowCreateResponse,
  normalizeGrowInquiryResponse,
  normalizeGrowRefundResponse,
} from "./growNormalization.js";

function majorAmount(amountMinor) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", undefined, 500);
  }
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`;
}

function appendFields(form, fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    form.append(key, String(value));
  }
}

function parseProviderBody(text) {
  const source = String(text || "").trim();
  if (!source) {
    throw new PaymentError("GROW_EMPTY_RESPONSE", undefined, 502, {
      outcomeUnknown: true,
      retryable: true,
    });
  }
  if (source.length > 128 * 1024) {
    throw new PaymentError("GROW_RESPONSE_TOO_LARGE", undefined, 502, {
      outcomeUnknown: true,
    });
  }
  try {
    return JSON.parse(source);
  } catch {
    const params = new URLSearchParams(source);
    const object = Object.fromEntries(params.entries());
    if (Object.keys(object).length > 0) return object;
    throw new PaymentError("GROW_RESPONSE_INVALID", undefined, 502, {
      outcomeUnknown: true,
    });
  }
}

export class GrowProvider {
  constructor(config, { fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new PaymentError("PAYMENT_FETCH_UNAVAILABLE", undefined, 500);
    }
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  authFields(pageCode) {
    return {
      userId: this.config.userId,
      pageCode,
      ...(this.config.apiKey ? { apiKey: this.config.apiKey } : {}),
    };
  }

  async post(operation, fields, { outcomeUnknownOnFailure = false } = {}) {
    const form = new FormData();
    appendFields(form, fields);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/${operation}`, {
        method: "POST",
        body: form,
        signal: controller.signal,
        redirect: "error",
        headers: { Accept: "application/json" },
      });
      const text = await response.text();
      if (!response.ok) {
        throw new PaymentError("GROW_HTTP_ERROR", undefined, 502, {
          retryable: response.status >= 500,
          outcomeUnknown: outcomeUnknownOnFailure && response.status >= 500,
        });
      }
      return parseProviderBody(text);
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      const timedOut = error?.name === "AbortError";
      throw new PaymentError(timedOut ? "GROW_TIMEOUT" : "GROW_NETWORK_ERROR", undefined, 502, {
        cause: error,
        retryable: true,
        outcomeUnknown: outcomeUnknownOnFailure,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async createPaymentProcess({ order, payer, method, urls, product }) {
    const pageCode = this.config.pageCodes[method];
    if (!pageCode) {
      throw new PaymentError(
        "PAYMENT_METHOD_UNAVAILABLE",
        "אמצעי התשלום שבחרתם אינו זמין כרגע.",
        409,
      );
    }
    const response = await this.post(
      "createPaymentProcess",
      {
        ...this.authFields(pageCode),
        chargeType: 1,
        sum: majorAmount(product.amountMinor),
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        notifyUrl: urls.notifyUrl,
        invoiceNotifyUrl: urls.invoiceNotifyUrl,
        description: product.productKey,
        "pageField[invoiceName]": payer.fullName,
        "pageField[fullName]": payer.fullName,
        "pageField[phone]": payer.phone,
        "pageField[email]": payer.email,
        cField1: product.productKey,
        cField2: product.currency,
        saveCardToken: 0,
        paymentNum: 1,
        maxPaymentNum: 1,
      },
      { outcomeUnknownOnFailure: true },
    );
    return {
      ...normalizeGrowCreateResponse(response, this.config.baseUrl),
      pageCode,
      provider: "grow",
      orderPublicId: order.publicId,
    };
  }

  async getPaymentProcessInfo({ order }) {
    const response = await this.post("getPaymentProcessInfo", {
      ...this.authFields(order.growPageCode),
      processId: order.growProcessId,
      processToken: order.growProcessToken,
    });
    return normalizeGrowInquiryResponse(response);
  }

  async approveTransaction({ order, evidence }) {
    const response = await this.post(
      "approveTransaction",
      {
        ...this.authFields(order.growPageCode),
        ...evidence.approvalFields,
        processId: evidence.processId,
        processToken: evidence.processToken,
        transactionId: evidence.transactionId,
        transactionToken: evidence.transactionToken,
        sum: majorAmount(evidence.amountMinor),
      },
      { outcomeUnknownOnFailure: true },
    );
    return normalizeGrowApprovalResponse(response);
  }

  async refundTransaction({ order }) {
    const response = await this.post(
      "refundTransaction",
      {
        ...this.authFields(order.growPageCode),
        transactionId: order.growTransactionId,
        transactionToken: order.growTransactionToken,
        refundSum: majorAmount(order.amountMinor),
      },
      { outcomeUnknownOnFailure: true },
    );
    return normalizeGrowRefundResponse(response);
  }
}
