export const AI_COUNSELOR_TOP_TWO_PRODUCT_KEY = "ai_counselor_top_two";

export const PAYMENT_METHOD_PRIORITY = Object.freeze(["apple_pay", "bit", "google_pay", "card"]);

const products = {
  [AI_COUNSELOR_TOP_TWO_PRODUCT_KEY]: Object.freeze({
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    displayName: "פתיחת מקומות 3, 2 ו־1",
    // Must equal the price on the Grow payment link: webhooks with any other amount are ignored.
    amountMinor: 2499,
    currency: "ILS",
    permanent: true,
    futureRecalculationsIncluded: true,
    vatIncludedWhereApplicable: true,
    billingType: "one_time",
  }),
};

export const PAYMENT_CATALOG = Object.freeze(products);

export function getPaymentProduct(productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY) {
  const key = String(productKey || "");
  if (!Object.hasOwn(PAYMENT_CATALOG, key)) {
    const error = new Error("Unknown payment product");
    error.code = "PAYMENT_PRODUCT_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }
  return PAYMENT_CATALOG[key];
}

export function publicPaymentProduct(productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY) {
  const product = getPaymentProduct(productKey);
  return {
    productKey: product.productKey,
    displayName: product.displayName,
    amountMinor: product.amountMinor,
    currency: product.currency,
    permanent: product.permanent,
    futureRecalculationsIncluded: product.futureRecalculationsIncluded,
    vatIncludedWhereApplicable: product.vatIncludedWhereApplicable,
    billingType: product.billingType,
  };
}
